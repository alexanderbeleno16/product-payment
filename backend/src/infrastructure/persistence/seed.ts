import { ProductEntity } from './product.entity';
import { createDataSource } from './data-source';

const dummyProducts: ProductEntity[] = [
  {
    id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
    name: 'Wireless Headphones',
    description: 'Over-ear wireless headphones',
    currency: 'COP',
    priceCents: 12990000,
    stock: 12,
  },
  {
    id: '3685f095-a601-4ca6-ab54-0f8eb66bccd8',
    name: 'Portable Speaker',
    description: 'Compact Bluetooth speaker',
    currency: 'COP',
    priceCents: 7990000,
    stock: 8,
  },
];

async function seed(): Promise<void> {
  const dataSource = createDataSource();
  try {
    await dataSource.initialize();
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(ProductEntity)
      .values(dummyProducts)
      .orIgnore()
      .execute();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void seed().catch((error: unknown) => {
  console.error('Database seed failed', { code: getErrorCode(error) });
  process.exitCode = 1;
});

function getErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'UNKNOWN';
}
