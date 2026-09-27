import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PaymentEventVerifier } from '../src/adapters/inbound/http/payment-event.verifier';
import { createDataSource } from '../src/adapters/outbound/persistence/data-source';
import { DatabaseConnection } from '../src/adapters/outbound/persistence/database-connection';
import { DeliveryEntity } from '../src/adapters/outbound/persistence/delivery.entity';
import { ProductEntity } from '../src/adapters/outbound/persistence/product.entity';
import { CustomerEntity } from '../src/adapters/outbound/persistence/customer.entity';
import { TransactionEntity } from '../src/adapters/outbound/persistence/transaction.entity';
import { TypeOrmCheckoutStore } from '../src/adapters/outbound/persistence/typeorm-checkout.store';
import { TypeOrmProductReader } from '../src/adapters/outbound/persistence/typeorm-product.reader';
import type { CheckoutTransaction } from '../src/application/checkout';
import type { VerifiedPaymentSnapshot } from '../src/application/finalize-verified-payment';
import { StartCheckout } from '../src/application/start-checkout';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from '../src/checkout.tokens';
import { PRODUCT_READER } from '../src/products.module';

const testDatabaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;
const productId = '4b9e9c38-3c42-44c6-9cf3-1ab94eec3605';
const secret = 'test_events_fixture_only';

function signedEvent(snapshot: VerifiedPaymentSnapshot) {
  const timestamp = 1530291411;
  const properties = ['transaction.id', 'transaction.status'];
  return {
    event: 'transaction.updated',
    environment: 'test',
    data: {
      transaction: {
        id: snapshot.providerTransactionId,
        status: snapshot.status,
        reference: snapshot.reference,
        amount_in_cents: snapshot.amountCents,
        currency: snapshot.currency,
      },
    },
    signature: {
      properties,
      checksum: createHash('sha256')
        .update(
          `${snapshot.providerTransactionId}${snapshot.status}${timestamp}${secret}`,
        )
        .digest('hex'),
    },
    timestamp,
    sent_at: '2026-09-26T00:00:00.000Z',
  };
}

(testDatabaseUrl ? describe : describe.skip)(
  'Signed event through real PostgreSQL finalization (e2e)',
  () => {
    let dataSource: DataSource;
    let app: INestApplication<App>;
    let checkout: TypeOrmCheckoutStore;
    let start: StartCheckout;
    const getById = jest.fn();
    const submit = jest.fn();
    let awaitConcurrentProductReads: (() => Promise<void>) | null = null;

    async function createCheckout(
      status: VerifiedPaymentSnapshot['status'],
    ): Promise<{
      transaction: CheckoutTransaction;
      snapshot: VerifiedPaymentSnapshot;
    }> {
      const result = await start.execute({
        idempotencyKey: randomUUID(),
        productId,
        quantity: 1,
        installments: 1,
        customerEmail: 'buyer@example.com',
        delivery: {
          recipientName: 'Ada Lovelace',
          addressLine: '123 Main Street',
          city: 'Bogota',
        },
      });
      if (!result.ok)
        throw new Error(`Checkout setup failed: ${result.reason}`);
      const transaction = result.value;
      await checkout.claimSubmission(transaction.reference);
      const snapshot: VerifiedPaymentSnapshot = {
        providerTransactionId: randomUUID(),
        reference: transaction.reference,
        amountCents: transaction.totalCents,
        currency: 'COP',
        status,
      };
      await checkout.recordSubmissionOutcome(transaction.reference, {
        kind: 'ACCEPTED',
        providerTransactionId: snapshot.providerTransactionId,
      });
      return { transaction, snapshot };
    }

    beforeAll(async () => {
      const parsed = new URL(testDatabaseUrl!);
      if (!parsed.pathname.endsWith('_test')) {
        throw new Error(
          'CHECKOUT_TEST_DATABASE_URL must end in a _test database',
        );
      }
      const previous = process.env.DATABASE_URL;
      try {
        process.env.DATABASE_URL = testDatabaseUrl;
        dataSource = createDataSource();
      } finally {
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
      }
      await dataSource.initialize();
      await dataSource.runMigrations();
      const connection = { get: async () => dataSource } as DatabaseConnection;
      checkout = new TypeOrmCheckoutStore(connection);
      const products = new TypeOrmProductReader(connection);
      start = new StartCheckout(products, checkout);
      const fixture = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DatabaseConnection)
        .useValue(connection)
        .overrideProvider(PRODUCT_READER)
        .useValue({
          findById: async (id: string) => {
            const product = await products.findById(id);
            if (awaitConcurrentProductReads)
              await awaitConcurrentProductReads();
            return product;
          },
        })
        .overrideProvider(PAYMENT_STATUS_READER)
        .useValue({ getById })
        .overrideProvider(PAYMENT_GATEWAY)
        .useValue({ submit })
        .overrideProvider(CONSENT_TERMS_READER)
        .useValue({ getCurrent: jest.fn() })
        .overrideProvider(PaymentEventVerifier)
        .useValue(new PaymentEventVerifier(secret))
        .compile();
      app = fixture.createNestApplication();
      await app.init();
    });

    beforeEach(async () => {
      jest.clearAllMocks();
      await dataSource.query(
        'TRUNCATE TABLE deliveries, transactions, customers',
      );
      await dataSource.getRepository(ProductEntity).upsert(
        {
          id: productId,
          name: 'Test Product',
          description: 'Isolated test product',
          currency: 'COP',
          priceCents: 1_000_000,
          stock: 3,
        },
        ['id'],
      );
    });

    afterAll(async () => {
      if (app) await app.close();
      if (dataSource?.isInitialized) await dataSource.destroy();
    });

    it('creates and submits only one checkout when two HTTP requests race on the same key', async () => {
      const key = randomUUID();
      let arrivals = 0;
      let release!: () => void;
      const bothAtProductRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      awaitConcurrentProductReads = async () => {
        arrivals += 1;
        if (arrivals === 2) release();
        await bothAtProductRead;
      };
      submit.mockResolvedValue({
        kind: 'ACCEPTED',
        providerTransactionId: 'remote-race-fixture-id',
      });
      const body = {
        productId,
        quantity: 1,
        installments: 1,
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

      try {
        const responses = await Promise.all(
          [1, 2].map(() =>
            request(app.getHttpServer())
              .post('/checkouts')
              .set('Idempotency-Key', key)
              .send(body),
          ),
        );
        expect(arrivals).toBe(2);
        expect(responses.map(({ status }) => status)).toEqual([201, 201]);
        expect(responses[0].body.reference).toMatch(/^txn_/);
        expect(responses[1].body.reference).toBe(responses[0].body.reference);
        expect(responses[1].body.quote).toEqual(responses[0].body.quote);
        for (const response of responses) {
          // A replay may observe the durable claim before its remote outcome is recorded.
          expect(['PENDING', 'SUBMISSION_UNKNOWN']).toContain(
            response.body.status,
          );
          expect(JSON.stringify(response.body)).not.toMatch(
            /buyer@example\.com|transient-card-token|remote-race-fixture-id/,
          );
        }
        expect(submit).toHaveBeenCalledTimes(1);
        expect(await dataSource.getRepository(TransactionEntity).count()).toBe(
          1,
        );
        expect(await dataSource.getRepository(CustomerEntity).count()).toBe(1);
        expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
        expect(
          (
            await dataSource
              .getRepository(ProductEntity)
              .findOneByOrFail({ id: productId })
          ).stock,
        ).toBe(3);
      } finally {
        awaitConcurrentProductReads = null;
      }
    });

    it('applies signed approval once across HTTP, authoritative lookup, and PostgreSQL', async () => {
      const { transaction, snapshot } = await createCheckout('APPROVED');
      getById.mockResolvedValueOnce({ ...snapshot, status: 'PENDING' });
      getById.mockResolvedValue(snapshot);
      const event = signedEvent(snapshot);
      await request(app.getHttpServer())
        .post('/payment/events')
        .send(event)
        .expect(503);
      expect(
        (
          await dataSource
            .getRepository(ProductEntity)
            .findOneByOrFail({ id: productId })
        ).stock,
      ).toBe(3);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);

      await request(app.getHttpServer())
        .post('/payment/events')
        .send(event)
        .expect(200)
        .expect({ accepted: true });
      expect(getById).toHaveBeenCalledWith(snapshot.providerTransactionId);
      expect(
        await dataSource
          .getRepository(TransactionEntity)
          .findOneByOrFail({ id: transaction.id }),
      ).toMatchObject({
        status: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        providerTransactionId: snapshot.providerTransactionId,
      });
      expect(
        (
          await dataSource
            .getRepository(ProductEntity)
            .findOneByOrFail({ id: productId })
        ).stock,
      ).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);

      await request(app.getHttpServer())
        .post('/payment/events')
        .send(event)
        .expect(200)
        .expect({ accepted: true });
      expect(
        (
          await dataSource
            .getRepository(ProductEntity)
            .findOneByOrFail({ id: productId })
        ).stock,
      ).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
    });

    it('records signed decline without stock or delivery effects', async () => {
      const { transaction, snapshot } = await createCheckout('DECLINED');
      getById.mockResolvedValue(snapshot);
      await request(app.getHttpServer())
        .post('/payment/events')
        .send(signedEvent(snapshot))
        .expect(200);
      expect(
        await dataSource
          .getRepository(TransactionEntity)
          .findOneByOrFail({ id: transaction.id }),
      ).toMatchObject({
        status: 'DECLINED',
        fulfillmentStatus: 'NOT_STARTED',
      });
      expect(
        (
          await dataSource
            .getRepository(ProductEntity)
            .findOneByOrFail({ id: productId })
        ).stock,
      ).toBe(3);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
    });
  },
);
