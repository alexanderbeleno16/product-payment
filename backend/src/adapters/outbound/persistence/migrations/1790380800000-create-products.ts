import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1790380800000 implements MigrationInterface {
  name = 'CreateProducts1790380800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE products (
        id uuid PRIMARY KEY,
        name varchar(120) NOT NULL,
        description text NOT NULL,
        currency varchar(3) NOT NULL CONSTRAINT products_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
        price_cents integer NOT NULL CONSTRAINT products_price_positive CHECK (price_cents > 0),
        stock integer NOT NULL CONSTRAINT products_stock_nonnegative CHECK (stock >= 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE products');
  }
}
