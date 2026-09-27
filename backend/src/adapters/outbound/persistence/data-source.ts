import { DataSource } from 'typeorm';
import { ProductEntity } from './product.entity';
import { CreateProducts1790380800000 } from './migrations/1790380800000-create-products';
import { CreateCheckout1790467200000 } from './migrations/1790467200000-create-checkout';
import { CustomerEntity } from './customer.entity';
import { TransactionEntity } from './transaction.entity';
import { DeliveryEntity } from './delivery.entity';
import { CreateDeliveries1790553600000 } from './migrations/1790553600000-create-deliveries';

export function createDataSource(): DataSource {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      ProductEntity,
      CustomerEntity,
      TransactionEntity,
      DeliveryEntity,
    ],
    migrations: [
      CreateProducts1790380800000,
      CreateCheckout1790467200000,
      CreateDeliveries1790553600000,
    ],
    synchronize: false,
    migrationsRun: false,
  });
}
