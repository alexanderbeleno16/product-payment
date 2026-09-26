import { DataSource } from 'typeorm';
import { ProductEntity } from './product.entity';
import { CreateProducts1790380800000 } from './migrations/1790380800000-create-products';

export function createDataSource(): DataSource {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [ProductEntity],
    migrations: [CreateProducts1790380800000],
    synchronize: false,
    migrationsRun: false,
  });
}
