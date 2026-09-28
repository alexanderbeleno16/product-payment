import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { ReconcilePendingPayments } from '../../../application/reconcile-pending-payments';
import { ReconcileKnownPayment } from '../../../application/reconcile-known-payment';
import type { DatabaseConnection } from './database-connection';
import { createDataSource } from './data-source';
import { TypeOrmPendingReconciliationQueue } from './typeorm-pending-reconciliation.queue';

const databaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)(
  'pending reconciliation lease with PostgreSQL',
  () => {
    let source: DataSource;
    let queue: TypeOrmPendingReconciliationQueue;

    beforeAll(async () => {
      if (!new URL(databaseUrl!).pathname.endsWith('_test'))
        throw new Error('Only an isolated _test database is allowed');
      const previous = process.env.DATABASE_URL;
      try {
        process.env.DATABASE_URL = databaseUrl;
        source = createDataSource();
      } finally {
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
      }
      await source.initialize();
      await source.runMigrations();
      queue = new TypeOrmPendingReconciliationQueue({
        get: async () => source,
      } as DatabaseConnection);
    });

    beforeEach(async () => {
      await source.query(
        'TRUNCATE TABLE deliveries, transactions, customers, products CASCADE',
      );
    });

    afterAll(async () => {
      if (source?.isInitialized) await source.destroy();
    });

    async function pending(): Promise<string> {
      const productId = randomUUID();
      const customerId = randomUUID();
      const reference = `txn_${randomUUID()}`;
      await source.query(
        `INSERT INTO products (id, name, description, currency, price_cents, stock)
      VALUES ($1, 'Test', 'Test', 'COP', 1000, 5)`,
        [productId],
      );
      await source.query(
        `INSERT INTO customers (id, email, recipient_name, address_line, city)
      VALUES ($1, 'test@example.com', 'Test', 'Test', 'Test')`,
        [customerId],
      );
      await source.query(
        `INSERT INTO transactions (id, customer_id, product_id, quantity, currency,
      unit_price_cents, product_amount_cents, base_fee_cents, delivery_fee_cents, total_cents,
      status, fulfillment_status, reference, idempotency_key, request_fingerprint,
      submission_started_at, provider_transaction_id, created_at)
      VALUES ($1, $2, $3, 1, 'COP', 1000, 1000, 0, 0, 1000,
      'PENDING', 'NOT_STARTED', $4, $5, $6, now() - interval '2 minutes', $7, now() - interval '2 minutes')`,
        [
          randomUUID(),
          customerId,
          productId,
          reference,
          randomUUID(),
          'f'.repeat(64),
          randomUUID(),
        ],
      );
      return reference;
    }

    it('claims once across concurrent workers and reclaims an expired lease', async () => {
      const reference = await pending();
      const [a, b] = await Promise.all([
        queue.claim(1, 30, 90),
        queue.claim(1, 30, 90),
      ]);
      expect([...a, ...b]).toHaveLength(1);
      expect([...a, ...b][0].reference).toBe(reference);
      expect(await queue.claim(1, 30, 90)).toEqual([]);
      await source.query(
        `UPDATE transactions SET reconciliation_lease_until = now() - interval '1 second' WHERE reference = $1`,
        [reference],
      );
      const recovered = await queue.claim(1, 30, 90);
      expect(recovered).toHaveLength(1);
      expect(recovered[0].attempt).toBe(2);
      await queue.release([...a, ...b][0], 15);
      expect(await queue.claim(1, 30, 90)).toEqual([]);
      await queue.release(recovered[0], 15);
    });

    it('ignores records without a bound provider ID or submitted state', async () => {
      const reference = await pending();
      await source.query(
        'UPDATE transactions SET provider_transaction_id = NULL WHERE reference = $1',
        [reference],
      );
      expect(await queue.claim(5, 30, 90)).toEqual([]);
    });

    it('leaves later work claimable by another worker during a slow lookup', async () => {
      const first = await pending();
      const second = await pending();
      let finishLookup!: (result: { ok: true }) => void;
      const execute = jest.fn().mockImplementationOnce(
        () => new Promise((resolve) => { finishLookup = resolve; }),
      ).mockResolvedValue({ ok: true });
      const worker = new ReconcilePendingPayments(
        queue,
        { execute } as unknown as ReconcileKnownPayment,
      );

      const running = worker.run(2, 30, 90);
      for (let attempt = 0; attempt < 20 && execute.mock.calls.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const processing = execute.mock.calls[0]?.[0] as string;
      expect([first, second]).toContain(processing);
      const competingClaim = await queue.claim(1, 30, 90);
      expect(competingClaim.map((claim) => claim.reference)).toEqual([
        processing === first ? second : first,
      ]);

      finishLookup({ ok: true });
      await expect(running).resolves.toEqual({ checked: 1, failures: 0 });
      await queue.release(competingClaim[0], 15);
    });
  },
);
