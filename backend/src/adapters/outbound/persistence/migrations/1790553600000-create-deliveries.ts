import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeliveries1790553600000 implements MigrationInterface {
  name = 'CreateDeliveries1790553600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transactions
        ADD COLUMN fulfillment_status varchar(24) NOT NULL DEFAULT 'NOT_STARTED',
        ADD CONSTRAINT transactions_fulfillment_status_valid
          CHECK (fulfillment_status IN ('NOT_STARTED', 'CREATED', 'STOCK_UNAVAILABLE')),
        ADD CONSTRAINT transactions_fulfillment_requires_approval
          CHECK ((status = 'APPROVED') = (fulfillment_status <> 'NOT_STARTED'))
    `);
    await queryRunner.query(`
      CREATE TABLE deliveries (
        id uuid PRIMARY KEY,
        transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
        customer_id uuid NOT NULL REFERENCES customers(id),
        product_id uuid NOT NULL REFERENCES products(id),
        quantity integer NOT NULL CONSTRAINT deliveries_quantity_positive CHECK (quantity > 0),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE deliveries');
    await queryRunner.query(
      'ALTER TABLE transactions DROP COLUMN fulfillment_status',
    );
  }
}
