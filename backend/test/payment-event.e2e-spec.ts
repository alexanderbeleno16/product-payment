import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PaymentEventVerifier } from '../src/adapters/inbound/http/payment-event.verifier';
import { FinalizeVerifiedPayment } from '../src/application/finalize-verified-payment';
import { CHECKOUT_STORE } from '../src/checkout.module';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from '../src/checkout.tokens';
import { PRODUCT_READER } from '../src/products.module';
import { configureOpenApi } from '../src/openapi';

const secret = 'test_events_fixture_only';
const providerId = 'provider-transaction-1';
const authoritative = {
  providerTransactionId: providerId,
  reference: 'txn_test-reference',
  amountCents: 2_700_000,
  currency: 'COP',
  status: 'APPROVED',
};

function signedEvent(
  properties = [
    'transaction.id',
    'transaction.status',
    'transaction.amount_in_cents',
  ],
  eventStatus = 'APPROVED',
) {
  const transaction = {
    id: providerId,
    status: eventStatus,
    amount_in_cents: 2_700_000,
    reference: authoritative.reference,
    currency: 'COP',
    customer_email: 'buyer@example.com',
  };
  const values = properties.map((property) =>
    String(
      transaction[
        property.slice('transaction.'.length) as keyof typeof transaction
      ],
    ),
  );
  const timestamp = 1530291411;
  return {
    event: 'transaction.updated',
    data: { transaction },
    environment: 'test',
    signature: {
      properties,
      checksum: createHash('sha256')
        .update(`${values.join('')}${timestamp}${secret}`)
        .digest('hex'),
    },
    timestamp,
    sent_at: '2026-09-26T00:00:00.000Z',
  };
}

describe('Signed payment event HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  const getById = jest.fn();
  const finalize = jest.fn();

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRODUCT_READER)
      .useValue({ findById: jest.fn() })
      .overrideProvider(CHECKOUT_STORE)
      .useValue({
        findByIdempotencyKey: jest.fn(),
        createPending: jest.fn(),
        claimSubmission: jest.fn(),
        recordSubmissionOutcome: jest.fn(),
      })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({ submit: jest.fn() })
      .overrideProvider(CONSENT_TERMS_READER)
      .useValue({ getCurrent: jest.fn() })
      .overrideProvider(PAYMENT_STATUS_READER)
      .useValue({ getById })
      .overrideProvider(FinalizeVerifiedPayment)
      .useValue({ execute: finalize })
      .overrideProvider(PaymentEventVerifier)
      .useValue(new PaymentEventVerifier(secret))
      .compile();
    app = fixture.createNestApplication();
    configureOpenApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getById.mockResolvedValue(authoritative);
    finalize.mockResolvedValue({
      ok: true,
      value: {
        reference: authoritative.reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 only after a signed ID resolves to a durable authoritative finalization', async () => {
    const event = signedEvent([
      'transaction.status',
      'transaction.id',
      'transaction.amount_in_cents',
    ]);
    await request(app.getHttpServer())
      .post('/payment/events')
      .set('X-Event-Checksum', event.signature.checksum.toUpperCase())
      .send(event)
      .expect(200)
      .expect({ accepted: true });
    expect(getById).toHaveBeenCalledWith(providerId);
    expect(finalize).toHaveBeenCalledWith(authoritative);
  });

  it('acknowledges an already applied or stale signed event without a second fulfillment', async () => {
    finalize.mockResolvedValueOnce({
      ok: true,
      value: {
        reference: authoritative.reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: false,
      },
    });
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent())
      .expect(200);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('uses current private lookup status rather than a stale signed event status', async () => {
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent(['transaction.id', 'transaction.status'], 'PENDING'))
      .expect(200);
    expect(finalize).toHaveBeenCalledWith(authoritative);
  });

  it('rejects malformed, production, unsigned-ID, duplicate-property and forged events before lookup', async () => {
    const valid = signedEvent();
    await request(app.getHttpServer())
      .post('/payment/events')
      .send({ ...valid, environment: 'prod' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send({ ...valid, event: 'other.updated' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send({ ...valid, extra: 'not allowed' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent(['transaction.status']))
      .expect(401);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent(['transaction.id', 'transaction.id']))
      .expect(400);
    await request(app.getHttpServer())
      .post('/payment/events')
      .set('X-Event-Checksum', '0'.repeat(64))
      .send(valid)
      .expect(401);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send({
        ...valid,
        data: { transaction: { ...valid.data.transaction, id: 'another-id' } },
      })
      .expect(401);
    expect(getById).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('returns a retryable non-200 when provider lookup or durable storage is unavailable', async () => {
    getById.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent())
      .expect(503);
    expect(finalize).not.toHaveBeenCalled();
    finalize.mockRejectedValueOnce(new Error('temporary database failure'));
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent())
      .expect(500)
      .expect(({ body }) =>
        expect(JSON.stringify(body)).not.toContain(
          'temporary database failure',
        ),
      );
  });

  it('does not acknowledge a binding conflict or missing local checkout', async () => {
    finalize.mockResolvedValueOnce({ ok: false, reason: 'MISMATCH' });
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent())
      .expect(409);
    finalize.mockResolvedValueOnce({ ok: false, reason: 'NOT_FOUND' });
    await request(app.getHttpServer())
      .post('/payment/events')
      .send(signedEvent())
      .expect(404);
  });

  it('documents the signed event contract and retry statuses in OpenAPI', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);
    const operation = document.paths['/payment/events'].post;
    expect(operation.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/PaymentEventDto',
    );
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '409', '503']),
    );
  });
});
