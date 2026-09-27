import { DataSource } from 'typeorm';
import type { CheckoutInput } from '../../../application/checkout';
import { StartCheckout } from '../../../application/start-checkout';
import { ProductEntity } from './product.entity';
import { createDataSource } from './data-source';
import type { DatabaseConnection } from './database-connection';
import { TransactionEntity } from './transaction.entity';
import { CustomerEntity } from './customer.entity';
import { TypeOrmCheckoutStore } from './typeorm-checkout.store';
import { TypeOrmProductReader } from './typeorm-product.reader';
import { IdempotencyKeyTaken } from '../../../application/checkout-store.port';

const testDatabaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;
const testProductId = 'd815b5c8-4458-4b77-8286-b2d523552959';
const input: CheckoutInput = {
  idempotencyKey: '9af0bfbc-9881-4e60-a17b-693b134c9142',
  productId: testProductId,
  quantity: 2,
  installments: 1,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
};

(testDatabaseUrl ? describe : describe.skip)(
  'TypeOrmCheckoutStore with PostgreSQL',
  () => {
    let dataSource: DataSource;
    let store: TypeOrmCheckoutStore;
    let start: StartCheckout;

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
      store = new TypeOrmCheckoutStore(connection);
      start = new StartCheckout(new TypeOrmProductReader(connection), store);
    });

    beforeEach(async () => {
      await dataSource.query('TRUNCATE TABLE deliveries, transactions, customers');
      await dataSource.getRepository(ProductEntity).upsert(
        {
          id: testProductId,
          name: 'Test Product',
          description: 'Isolated test product',
          currency: 'COP',
          priceCents: 10_000_000,
          stock: 4,
        },
        ['id'],
      );
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
    });

    it('atomically persists one customer/PENDING checkout under a concurrent duplicate key', async () => {
      const [a, b] = await Promise.all([
        start.execute(input),
        start.execute(input),
      ]);
      expect(a.ok).toBe(true);
      expect(b).toEqual(a);
      const transactions = await dataSource
        .getRepository(TransactionEntity)
        .findBy({ productId: testProductId });
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        status: 'PENDING',
        quantity: 2,
        productAmountCents: 20_000_000,
        baseFeeCents: 200_000,
        deliveryFeeCents: 500_000,
        totalCents: 20_700_000,
      });
      expect(await dataSource.getRepository(CustomerEntity).count()).toBe(1);
      expect(
        await dataSource
          .getRepository(ProductEntity)
          .findOneByOrFail({ id: testProductId }),
      ).toMatchObject({ stock: 4 });
      expect(await store.claimSubmission(transactions[0].reference)).toBe(true);
      expect(await store.claimSubmission(transactions[0].reference)).toBe(
        false,
      );
      const claimed = await store.findByIdempotencyKey(input.idempotencyKey);
      expect(claimed).toMatchObject({
        status: 'SUBMISSION_UNKNOWN',
        providerTransactionId: null,
      });
      expect(claimed?.submissionStartedAt).toBeInstanceOf(Date);
    });

    it('returns the original quote after price and stock change, while a changed payload conflicts', async () => {
      const first = await start.execute(input);
      expect(first.ok).toBe(true);
      await dataSource
        .getRepository(ProductEntity)
        .update(testProductId, { priceCents: 20_000_000, stock: 0 });
      expect(await start.execute(input)).toEqual(first);
      expect(await start.execute({ ...input, quantity: 3 })).toEqual({
        ok: false,
        reason: 'IDEMPOTENCY_CONFLICT',
      });
    });

    it('maps only the idempotency-key unique constraint to the typed duplicate signal', async () => {
      const first = await start.execute(input);
      if (!first.ok) throw new Error('Expected pending checkout');
      await expect(
        store.createPending({
          id: '511da8e3-4a22-430a-83f6-e8729df28679',
          reference: 'txn_511da8e3-4a22-430a-83f6-e8729df28679',
          input,
          quote: first.value,
          requestFingerprint: first.value.requestFingerprint,
        }),
      ).rejects.toBeInstanceOf(IdempotencyKeyTaken);
      expect(await dataSource.getRepository(CustomerEntity).count()).toBe(1);
    });

    it('persists only one conditional outcome after the durable claim', async () => {
      const first = await start.execute(input);
      if (!first.ok) throw new Error('Expected pending checkout');
      await expect(
        store.recordSubmissionOutcome(first.value.reference, {
          kind: 'UNKNOWN',
        }),
      ).rejects.toThrow('Submission outcome could not be recorded');
      expect(await store.claimSubmission(first.value.reference)).toBe(true);
      const updated = await store.recordSubmissionOutcome(
        first.value.reference,
        { kind: 'ACCEPTED', providerTransactionId: 'provider-test-1' },
      );
      expect(updated).toMatchObject({
        status: 'PENDING',
        providerTransactionId: 'provider-test-1',
      });
      await expect(
        store.recordSubmissionOutcome(first.value.reference, {
          kind: 'REJECTED',
        }),
      ).rejects.toThrow('Submission outcome could not be recorded');
      expect(await store.claimSubmission(first.value.reference)).toBe(false);
      expect(
        await dataSource.getRepository(ProductEntity).findOneByOrFail({
          id: testProductId,
        }),
      ).toMatchObject({ stock: 4 });
    });

    it('persists an ambiguous submission without stock or delivery effects', async () => {
      const first = await start.execute(input);
      if (!first.ok) throw new Error('Expected pending checkout');
      expect(await store.claimSubmission(first.value.reference)).toBe(true);
      // A crash before any provider result is durably observable as unknown.
      expect(await store.findByIdempotencyKey(input.idempotencyKey)).toMatchObject({
        status: 'SUBMISSION_UNKNOWN',
        providerTransactionId: null,
      });
      expect(await store.claimSubmission(first.value.reference)).toBe(false);
      expect(
        await store.recordSubmissionOutcome(first.value.reference, {
          kind: 'UNKNOWN',
        }),
      ).toMatchObject({
        status: 'SUBMISSION_UNKNOWN',
        providerTransactionId: null,
      });
      expect(await store.claimSubmission(first.value.reference)).toBe(false);
      expect(
        await dataSource.getRepository(ProductEntity).findOneByOrFail({
          id: testProductId,
        }),
      ).toMatchObject({ stock: 4 });
    });
  },
);
