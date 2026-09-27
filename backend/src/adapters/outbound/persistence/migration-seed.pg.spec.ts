import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createDataSource } from './data-source';
import { migrate } from './migrate';
import { ProductEntity } from './product.entity';
import { seed } from './seed';

const testDatabaseUrl = process.env.CHECKOUT_TEST_DATABASE_URL;
const headphonesId = '8a52ea31-08d9-4f52-a604-00e56143dce0';

(testDatabaseUrl ? describe : describe.skip)(
  'database setup commands with PostgreSQL',
  () => {
    let admin: DataSource;
    let databaseName: string;
    let databaseUrl: string;
    let databaseCreated = false;

    function isolatedDataSource(): DataSource {
      const previous = process.env.DATABASE_URL;
      try {
        process.env.DATABASE_URL = databaseUrl;
        return createDataSource();
      } finally {
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
      }
    }

    beforeAll(async () => {
      const parsed = new URL(testDatabaseUrl!);
      if (!parsed.pathname.endsWith('_test')) {
        throw new Error(
          'CHECKOUT_TEST_DATABASE_URL must end in a _test database',
        );
      }
      databaseName = `checkout_cli_${randomUUID().replaceAll('-', '').slice(0, 12)}_test`;
      admin = new DataSource({ type: 'postgres', url: testDatabaseUrl });
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
      parsed.pathname = `/${databaseName}`;
      databaseUrl = parsed.toString();
    });

    afterAll(async () => {
      if (admin?.isInitialized) {
        if (databaseCreated) {
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
        await admin.destroy();
      }
    });

    it('applies versioned migrations, seeds idempotently, and supports rollback and reapplication', async () => {
      const firstMigration = isolatedDataSource();
      await migrate(firstMigration);
      expect(firstMigration.isInitialized).toBe(false);

      const migrated = isolatedDataSource();
      await migrated.initialize();
      try {
        expect(await migrated.showMigrations()).toBe(false);
        expect(
          await migrated.query<{ name: string }[]>(
            'SELECT name FROM migrations ORDER BY timestamp',
          ),
        ).toEqual([
          { name: 'CreateProducts1790380800000' },
          { name: 'CreateCheckout1790467200000' },
          { name: 'CreateDeliveries1790553600000' },
        ]);
        expect(
          await migrated.query<
            {
              products: string;
              customers: string;
              transactions: string;
              deliveries: string;
            }[]
          >(
            `SELECT to_regclass('products')::text AS products,
                    to_regclass('customers')::text AS customers,
                    to_regclass('transactions')::text AS transactions,
                    to_regclass('deliveries')::text AS deliveries`,
          ),
        ).toEqual([
          {
            products: 'products',
            customers: 'customers',
            transactions: 'transactions',
            deliveries: 'deliveries',
          },
        ]);
      } finally {
        await migrated.destroy();
      }

      await migrate(isolatedDataSource());
      await seed(isolatedDataSource());
      await seed(isolatedDataSource());

      const stockChange = isolatedDataSource();
      await stockChange.initialize();
      try {
        expect(await stockChange.getRepository(ProductEntity).count()).toBe(2);
        await stockChange.getRepository(ProductEntity).update(headphonesId, {
          stock: 3,
        });
      } finally {
        await stockChange.destroy();
      }

      await seed(isolatedDataSource());
      const rollback = isolatedDataSource();
      await rollback.initialize();
      try {
        expect(await rollback.getRepository(ProductEntity).count()).toBe(2);
        expect(
          await rollback.getRepository(ProductEntity).findOneByOrFail({
            id: headphonesId,
          }),
        ).toMatchObject({ stock: 3, priceCents: 12_990_000 });

        await rollback.undoLastMigration();
        expect(
          await rollback.query("SELECT to_regclass('deliveries')"),
        ).toEqual([{ to_regclass: null }]);
        expect(
          await rollback.query("SELECT to_regclass('transactions')"),
        ).toEqual([{ to_regclass: 'transactions' }]);

        await rollback.undoLastMigration();
        expect(
          await rollback.query("SELECT to_regclass('transactions')"),
        ).toEqual([{ to_regclass: null }]);
        expect(await rollback.getRepository(ProductEntity).count()).toBe(2);

        await rollback.undoLastMigration();
        expect(await rollback.query("SELECT to_regclass('products')")).toEqual([
          { to_regclass: null },
        ]);
        expect(await rollback.showMigrations()).toBe(true);
      } finally {
        await rollback.destroy();
      }

      await migrate(isolatedDataSource());
      await seed(isolatedDataSource());
      const reapplied = isolatedDataSource();
      await reapplied.initialize();
      try {
        expect(await reapplied.getRepository(ProductEntity).count()).toBe(2);
        expect(await reapplied.showMigrations()).toBe(false);
      } finally {
        await reapplied.destroy();
      }
    });
  },
);
