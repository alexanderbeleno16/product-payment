import { DataSource } from 'typeorm';
import type { CheckoutInput } from '../../application/checkout';
import { StartCheckout } from '../../application/start-checkout';
import { ProductEntity } from './product.entity';
import { createDataSource } from './data-source';
import type { DatabaseConnection } from './database-connection';
import { TransactionEntity } from './transaction.entity';
import { CustomerEntity } from './customer.entity';
import { TypeOrmCheckoutStore } from './typeorm-checkout.store';
import { TypeOrmProductReader } from './typeorm-product.reader';
import { IdempotencyKeyTaken } from '../../application/checkout-store.port';

const testDatabaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;
const testProductId = 'd815b5c8-4458-4b77-8286-b2d523552959';
const input: CheckoutInput = {
  idempotencyKey: '9af0bfbc-9881-4e60-a17b-693b134c9142',
  productId: testProductId,
  quantity: 2,
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
      await dataSource.query('TRUNCATE TABLE transactions, customers');
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
  },
);
