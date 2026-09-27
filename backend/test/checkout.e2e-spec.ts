import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { CheckoutTransaction } from '../src/application/checkout';
import type { CheckoutStore, NewPendingCheckout } from '../src/application/checkout-store.port';
import type { PaymentSubmissionOutcome } from '../src/application/payment-gateway.port';
import { CHECKOUT_STORE } from '../src/checkout.module';
import { CONSENT_TERMS_READER, PAYMENT_GATEWAY } from '../src/checkout.tokens';
import { PRODUCT_READER } from '../src/products.module';

const productId = '8a52ea31-08d9-4f52-a604-00e56143dce0';
const idempotencyKey = 'cf2cdd86-05ea-4c7c-adeb-812927f37873';
const product = {
  id: productId,
  name: 'Demo product',
  description: 'Test fixture',
  currency: 'COP',
  priceCents: 1_000_000,
  stock: 3,
};
const body = {
  productId,
  quantity: 1,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
  cardToken: 'transient-card-token',
  acceptanceToken: 'transient-terms-token',
  personalDataToken: 'transient-privacy-token',
  acceptsEndUserPolicy: true,
  acceptsPersonalDataAuthorization: true,
};

describe('Checkout HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  let saved: CheckoutTransaction | null;
  let claimed: boolean;
  const findById = jest.fn();
  const submit = jest.fn();
  const getCurrent = jest.fn();
  const createPending = jest.fn();
  const claimSubmission = jest.fn();
  const recordSubmissionOutcome = jest.fn();
  const findByIdempotencyKey = jest.fn();

  const store: CheckoutStore = {
    findByIdempotencyKey,
    createPending,
    claimSubmission,
    recordSubmissionOutcome,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    saved = null;
    claimed = false;
    findById.mockResolvedValue(product);
    findByIdempotencyKey.mockImplementation(async (key: string) =>
      saved?.idempotencyKey === key ? saved : null,
    );
    createPending.mockImplementation(async (command: NewPendingCheckout) => {
      saved = {
        ...command.quote,
        id: command.id,
        reference: command.reference,
        customerId: '99fa3ee4-49c8-47c6-a96b-ed89241fa516',
        idempotencyKey: command.input.idempotencyKey,
        requestFingerprint: command.requestFingerprint,
        status: 'PENDING',
        submissionStartedAt: null,
        providerTransactionId: null,
        createdAt: new Date('2026-09-26T00:00:00Z'),
      };
      return saved;
    });
    claimSubmission.mockImplementation(async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    });
    recordSubmissionOutcome.mockImplementation(
      async (_reference: string, outcome: PaymentSubmissionOutcome) => {
        saved = {
          ...saved!,
          status: outcome.kind === 'ACCEPTED' ? 'PENDING' : 'SUBMISSION_UNKNOWN',
          providerTransactionId: outcome.kind === 'ACCEPTED'
            ? outcome.providerTransactionId
            : null,
        };
        return saved;
      },
    );
    submit.mockResolvedValue({ kind: 'ACCEPTED', providerTransactionId: 'remote-private-id' });
    getCurrent.mockResolvedValue({
      publicKey: 'pub_test_example',
      endUserPolicy: { token: 'terms-token', permalink: 'https://example.test/terms' },
      personalDataAuthorization: {
        token: 'privacy-token',
        permalink: 'https://example.test/privacy',
      },
    });
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRODUCT_READER)
      .useValue({ findById })
      .overrideProvider(CHECKOUT_STORE)
      .useValue(store)
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({ submit })
      .overrideProvider(CONSENT_TERMS_READER)
      .useValue({ getCurrent })
      .compile();
    app = fixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a server-priced quote with strict quantity validation', async () => {
    await request(app.getHttpServer())
      .get('/checkout/quote')
      .query({ productId, quantity: '2' })
      .expect(200)
      .expect(({ body: response }) => {
        expect(response).toMatchObject({
          productId,
          quantity: 2,
          unitPriceCents: 1_000_000,
          totalCents: 2_700_000,
        });
      });
    await request(app.getHttpServer())
      .get('/checkout/quote')
      .query({ productId, quantity: '1.5' })
      .expect(400);
    expect(createPending).not.toHaveBeenCalled();
  });

  it('returns both current consent documents without caching', async () => {
    await request(app.getHttpServer())
      .get('/checkout/consents')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect(({ body: response }) => {
        expect(response).toEqual({
          publicKey: 'pub_test_example',
          endUserPolicy: { token: 'terms-token', permalink: 'https://example.test/terms' },
          personalDataAuthorization: {
            token: 'privacy-token',
            permalink: 'https://example.test/privacy',
          },
        });
      });
    expect(getCurrent).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid nested delivery, unknown values and missing consent before persistence', async () => {
    for (const invalid of [
      { ...body, delivery: { ...body.delivery, city: 12 } },
      { ...body, delivery: { ...body.delivery, extra: 'not allowed' } },
      { ...body, delivery: [body.delivery] },
      { ...body, priceCents: 1 },
      { ...body, status: 'APPROVED' },
      { ...body, acceptsEndUserPolicy: false },
      { ...body, acceptsPersonalDataAuthorization: false },
      { ...body, acceptsEndUserPolicy: undefined },
      { ...body, cardToken: undefined },
      { ...body, quantity: '1' },
    ]) {
      await request(app.getHttpServer())
        .post('/checkouts')
        .set('Idempotency-Key', idempotencyKey)
        .send(invalid)
        .expect(400);
    }
    expect(createPending).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('maps unavailable products and stock to safe HTTP outcomes', async () => {
    findById.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(404);
    findById.mockResolvedValueOnce({ ...product, stock: 0 });
    await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(409);
    expect(createPending).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('returns a safe service-unavailable error when current consent documents cannot be read', async () => {
    getCurrent.mockRejectedValueOnce(new Error('remote details must remain private'));
    await request(app.getHttpServer())
      .get('/checkout/consents')
      .expect(503)
      .expect(({ body: response }) => {
        expect(JSON.stringify(response)).not.toContain('remote details');
      });
  });

  it('requires a valid idempotency key before creating a checkout', async () => {
    await request(app.getHttpServer()).post('/checkouts').send(body).expect(400);
    await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', 'not-a-uuid')
      .send(body)
      .expect(400);
    expect(createPending).not.toHaveBeenCalled();
  });

  it('creates one pending checkout and returns only safe public data on replay', async () => {
    const first = await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(first.body).toEqual({
      reference: expect.stringMatching(/^txn_/),
      status: 'PENDING',
      quote: {
        productId,
        quantity: 1,
        currency: 'COP',
        unitPriceCents: 1_000_000,
        productAmountCents: 1_000_000,
        baseFeeCents: 200_000,
        deliveryFeeCents: 500_000,
        totalCents: 1_700_000,
      },
    });
    const responseText = JSON.stringify(first.body);
    for (const secret of [body.cardToken, body.customerEmail, idempotencyKey, 'remote-private-id']) {
      expect(responseText).not.toContain(secret);
    }
    await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201)
      .expect(first.body);
    await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...body, quantity: 2 })
      .expect(409);
    expect(createPending).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).not.toHaveProperty('acceptsEndUserPolicy');
    expect(submit.mock.calls[0][0]).not.toHaveProperty('acceptsPersonalDataAuthorization');
  });

  it('reads status only with the matching key and returns no private fields', async () => {
    const created = await request(app.getHttpServer())
      .post('/checkouts')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201);
    const url = `/transactions/${created.body.reference as string}`;
    await request(app.getHttpServer()).get(url).expect(400);
    await request(app.getHttpServer())
      .get(url)
      .set('Idempotency-Key', '124a6032-2b21-4dbb-ab90-f4d338b7631d')
      .expect(404);
    await request(app.getHttpServer())
      .get(url)
      .set('Idempotency-Key', idempotencyKey)
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ reference: created.body.reference, status: 'PENDING' });
  });
});
