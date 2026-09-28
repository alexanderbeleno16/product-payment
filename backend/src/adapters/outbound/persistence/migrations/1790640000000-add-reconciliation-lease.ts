import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReconciliationLease1790640000000 implements MigrationInterface {
  name = 'AddReconciliationLease1790640000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transactions
        ADD COLUMN reconciliation_attempts integer NOT NULL DEFAULT 0,
        ADD COLUMN reconciliation_next_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN reconciliation_lease_until timestamptz,
        ADD COLUMN reconciliation_lease_owner uuid,
        ADD CONSTRAINT transactions_reconciliation_attempts_positive
          CHECK (reconciliation_attempts >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX transactions_reconciliation_due_idx
        ON transactions (reconciliation_next_at, created_at)
        WHERE status = 'PENDING' AND provider_transaction_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX transactions_reconciliation_due_idx');
    await queryRunner.query(`
      ALTER TABLE transactions
        DROP CONSTRAINT transactions_reconciliation_attempts_positive,
        DROP COLUMN reconciliation_lease_owner,
        DROP COLUMN reconciliation_lease_until,
        DROP COLUMN reconciliation_next_at,
        DROP COLUMN reconciliation_attempts
    `);
  }
}
