import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type {
  CheckoutInput,
  CheckoutTransaction,
} from '../../../application/checkout';
import type { VerifiedPaymentSnapshot } from '../../../application/finalize-verified-payment';
import { StartCheckout } from '../../../application/start-checkout';
import type { DatabaseConnection } from './database-connection';
import { createDataSource } from './data-source';
import { DeliveryEntity } from './delivery.entity';
import { ProductEntity } from './product.entity';
import { TransactionEntity } from './transaction.entity';
import { TypeOrmCheckoutStore } from './typeorm-checkout.store';
import { TypeOrmFinalizationStore } from './typeorm-finalization.store';
import { TypeOrmProductReader } from './typeorm-product.reader';

const testDatabaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;
const productId = '9bf29f21-5931-45a9-a3fc-67a9728787b3';

(testDatabaseUrl ? describe : describe.skip)(
  'TypeOrmFinalizationStore with PostgreSQL',
  () => {
    let dataSource: DataSource;
    let checkout: TypeOrmCheckoutStore;
    let finalization: TypeOrmFinalizationStore;
    let start: StartCheckout;

    async function createCheckout(quantity = 2): Promise<CheckoutTransaction> {
      const input: CheckoutInput = {
        idempotencyKey: randomUUID(),
        productId,
        quantity,
        installments: 1,
        customerEmail: 'buyer@example.com',
        delivery: {
          recipientName: 'Ada Lovelace',
          addressLine: '123 Main Street',
          city: 'Bogota',
        },
      };
      const result = await start.execute(input);
      if (!result.ok)
        throw new Error(`Checkout setup failed: ${result.reason}`);
      return result.value;
    }

    function snapshot(
      transaction: CheckoutTransaction,
      status: VerifiedPaymentSnapshot['status'] = 'APPROVED',
      providerTransactionId: string = randomUUID(),
    ): VerifiedPaymentSnapshot {
      return {
        providerTransactionId,
        reference: transaction.reference,
        amountCents: transaction.totalCents,
        currency: 'COP',
        status,
      };
    }

    async function stock(): Promise<number> {
      const product = await dataSource
        .getRepository(ProductEntity)
        .findOneByOrFail({ id: productId });
      return product.stock;
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
      finalization = new TypeOrmFinalizationStore(connection);
      start = new StartCheckout(new TypeOrmProductReader(connection), checkout);
    });

    beforeEach(async () => {
      await dataSource.query(
        'TRUNCATE TABLE deliveries, transactions, customers',
      );
      await dataSource.getRepository(ProductEntity).upsert(
        {
          id: productId,
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

    it('binds approved result and creates one delivery with one stock decrement', async () => {
      const transaction = await createCheckout();
      expect(await checkout.claimSubmission(transaction.reference)).toBe(true);
      const confirmed = snapshot(transaction);
      await expect(finalization.finalize(confirmed)).resolves.toEqual({
        ok: true,
        value: {
          reference: transaction.reference,
          paymentStatus: 'APPROVED',
          fulfillmentStatus: 'CREATED',
          applied: true,
        },
      });
      expect(await stock()).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
      expect(
        await dataSource
          .getRepository(TransactionEntity)
          .findOneByOrFail({ id: transaction.id }),
      ).toMatchObject({
        status: 'APPROVED',
        providerTransactionId: confirmed.providerTransactionId,
        fulfillmentStatus: 'CREATED',
      });
      await expect(finalization.finalize(confirmed)).resolves.toMatchObject({
        ok: true,
        value: { applied: false },
      });
      expect(await stock()).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
    });

    it.each(['PENDING', 'DECLINED', 'VOIDED', 'ERROR'] as const)(
      '%s never changes stock or creates delivery',
      async (status) => {
        const transaction = await createCheckout();
        expect(await checkout.claimSubmission(transaction.reference)).toBe(
          true,
        );
        const result = await finalization.finalize(
          snapshot(transaction, status),
        );
        expect(result).toMatchObject({
          ok: true,
          value: { paymentStatus: status, fulfillmentStatus: 'NOT_STARTED' },
        });
        expect(await stock()).toBe(4);
        expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
      },
    );

    it('rejects unclaimed and mismatched authoritative facts without effects', async () => {
      const transaction = await createCheckout();
      const confirmed = snapshot(transaction);
      await expect(finalization.finalize(confirmed)).resolves.toEqual({
        ok: false,
        reason: 'NOT_SUBMITTED',
      });
      expect(await checkout.claimSubmission(transaction.reference)).toBe(true);
      await expect(
        finalization.finalize({
          ...confirmed,
          amountCents: confirmed.amountCents + 1,
        }),
      ).resolves.toEqual({ ok: false, reason: 'MISMATCH' });
      await expect(
        finalization.finalize({ ...confirmed, currency: 'USD' as 'COP' }),
      ).resolves.toEqual({ ok: false, reason: 'MISMATCH' });
      await expect(
        finalization.finalize({ ...confirmed, reference: 'unknown-reference' }),
      ).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
      expect(await stock()).toBe(4);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
    });

    it('rejects another provider ID after binding and a reused provider ID for another checkout', async () => {
      const first = await createCheckout(1);
      const second = await createCheckout(1);
      await checkout.claimSubmission(first.reference);
      await checkout.claimSubmission(second.reference);
      const confirmed = snapshot(first);
      await finalization.finalize(confirmed);
      await expect(
        finalization.finalize({
          ...confirmed,
          providerTransactionId: 'different-id',
        }),
      ).resolves.toEqual({ ok: false, reason: 'MISMATCH' });
      await expect(
        finalization.finalize(
          snapshot(second, 'APPROVED', confirmed.providerTransactionId),
        ),
      ).resolves.toEqual({ ok: false, reason: 'MISMATCH' });
      expect(await stock()).toBe(3);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
    });

    it('ignores stale pending after approval and rejects conflicting terminal result', async () => {
      const transaction = await createCheckout();
      await checkout.claimSubmission(transaction.reference);
      const confirmed = snapshot(transaction);
      await finalization.finalize(confirmed);
      await expect(
        finalization.finalize({ ...confirmed, status: 'PENDING' }),
      ).resolves.toMatchObject({
        ok: true,
        value: { paymentStatus: 'APPROVED', applied: false },
      });
      await expect(
        finalization.finalize({ ...confirmed, status: 'DECLINED' }),
      ).resolves.toEqual({ ok: false, reason: 'TERMINAL_CONFLICT' });
      expect(await stock()).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
    });

    it('keeps a final rejection terminal when a later approval arrives', async () => {
      const transaction = await createCheckout();
      await checkout.claimSubmission(transaction.reference);
      const rejected = snapshot(transaction, 'DECLINED');
      await finalization.finalize(rejected);
      await expect(
        finalization.finalize({ ...rejected, status: 'APPROVED' }),
      ).resolves.toEqual({ ok: false, reason: 'TERMINAL_CONFLICT' });
      expect(await stock()).toBe(4);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
    });

    it('serializes concurrent duplicate approvals through the locked transaction row', async () => {
      const transaction = await createCheckout();
      await checkout.claimSubmission(transaction.reference);
      const confirmed = snapshot(transaction);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => finalization.finalize(confirmed)),
      );
      expect(
        results.filter((result) => result.ok && result.value.applied),
      ).toHaveLength(1);
      expect(await stock()).toBe(2);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
    });

    it('records approved payment but no delivery when competing checkouts exhaust stock', async () => {
      await dataSource
        .getRepository(ProductEntity)
        .update(productId, { stock: 2 });
      const [first, second] = await Promise.all([
        createCheckout(),
        createCheckout(),
      ]);
      await checkout.claimSubmission(first.reference);
      await checkout.claimSubmission(second.reference);
      const results = await Promise.all([
        finalization.finalize(snapshot(first)),
        finalization.finalize(snapshot(second)),
      ]);
      const fulfillmentStatuses = results.map((result) => {
        if (!result.ok)
          throw new Error(`Finalization failed: ${result.reason}`);
        return result.value.fulfillmentStatus;
      });
      expect(fulfillmentStatuses.sort((a, b) => a.localeCompare(b))).toEqual([
        'CREATED',
        'STOCK_UNAVAILABLE',
      ]);
      expect(await stock()).toBe(0);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(1);
      expect(
        await dataSource
          .getRepository(TransactionEntity)
          .countBy({ status: 'APPROVED' }),
      ).toBe(2);
    });

    it('does not silently fulfill a stock-unavailable approval on replay after replenishment', async () => {
      const transaction = await createCheckout();
      await checkout.claimSubmission(transaction.reference);
      await dataSource
        .getRepository(ProductEntity)
        .update(productId, { stock: 0 });
      const confirmed = snapshot(transaction);
      await expect(finalization.finalize(confirmed)).resolves.toMatchObject({
        ok: true,
        value: {
          paymentStatus: 'APPROVED',
          fulfillmentStatus: 'STOCK_UNAVAILABLE',
          applied: true,
        },
      });
      await dataSource
        .getRepository(ProductEntity)
        .update(productId, { stock: 4 });
      await expect(finalization.finalize(confirmed)).resolves.toMatchObject({
        ok: true,
        value: {
          fulfillmentStatus: 'STOCK_UNAVAILABLE',
          applied: false,
        },
      });
      expect(await stock()).toBe(4);
      expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
    });

    it('rolls back stock and payment state if delivery insertion fails', async () => {
      const transaction = await createCheckout();
      await checkout.claimSubmission(transaction.reference);
      await dataSource.query(`
        CREATE FUNCTION reject_delivery_for_test() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'forced delivery failure'; END; $$
      `);
      await dataSource.query(`
        CREATE TRIGGER reject_delivery_for_test BEFORE INSERT ON deliveries
        FOR EACH ROW EXECUTE FUNCTION reject_delivery_for_test()
      `);
      try {
        await expect(
          finalization.finalize(snapshot(transaction)),
        ).rejects.toThrow('forced delivery failure');
        expect(await stock()).toBe(4);
        expect(await dataSource.getRepository(DeliveryEntity).count()).toBe(0);
        expect(
          await dataSource
            .getRepository(TransactionEntity)
            .findOneByOrFail({ id: transaction.id }),
        ).toMatchObject({
          status: 'SUBMISSION_UNKNOWN',
          providerTransactionId: null,
          fulfillmentStatus: 'NOT_STARTED',
        });
      } finally {
        await dataSource.query(
          'DROP TRIGGER reject_delivery_for_test ON deliveries',
        );
        await dataSource.query('DROP FUNCTION reject_delivery_for_test()');
      }
    });
  },
);
