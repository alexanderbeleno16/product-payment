import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckout1790467200000 implements MigrationInterface {
  name = 'CreateCheckout1790467200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customers (
        id uuid PRIMARY KEY,
        email varchar(254) NOT NULL,
        recipient_name varchar(120) NOT NULL,
        address_line varchar(240) NOT NULL,
        city varchar(120) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE transactions (
        id uuid PRIMARY KEY,
        customer_id uuid NOT NULL REFERENCES customers(id),
        product_id uuid NOT NULL REFERENCES products(id),
        quantity integer NOT NULL CONSTRAINT transactions_quantity_positive CHECK (quantity > 0),
        currency varchar(3) NOT NULL CONSTRAINT transactions_currency_cop CHECK (currency = 'COP'),
        unit_price_cents integer NOT NULL CONSTRAINT transactions_unit_price_positive CHECK (unit_price_cents > 0),
        product_amount_cents integer NOT NULL CONSTRAINT transactions_product_amount_positive CHECK (product_amount_cents > 0),
        base_fee_cents integer NOT NULL CONSTRAINT transactions_base_fee_nonnegative CHECK (base_fee_cents >= 0),
        delivery_fee_cents integer NOT NULL CONSTRAINT transactions_delivery_fee_nonnegative CHECK (delivery_fee_cents >= 0),
        total_cents integer NOT NULL CONSTRAINT transactions_total_positive CHECK (total_cents > 0),
        status varchar(24) NOT NULL,
        reference varchar(64) NOT NULL UNIQUE,
        idempotency_key uuid NOT NULL UNIQUE,
        request_fingerprint varchar(64) NOT NULL,
        submission_started_at timestamptz,
        provider_transaction_id varchar(120) UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT transactions_total_matches_parts CHECK (total_cents = product_amount_cents + base_fee_cents + delivery_fee_cents)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE transactions');
    await queryRunner.query('DROP TABLE customers');
  }
}
