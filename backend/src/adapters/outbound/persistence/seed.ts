import { ProductEntity } from './product.entity';
import { createDataSource } from './data-source';

const headphonesDescription =
  'Audífonos inalámbricos de diadema en color negro, con copas que rodean las orejas y un diseño sobrio para el uso diario. Pensados para escuchar música, pódcast y otros contenidos de audio sin depender de un cable.';
const speakerDescription =
  'Parlante portátil compacto con conexión Bluetooth para reproducir música y otros contenidos de audio desde un dispositivo compatible. Su tamaño facilita ubicarlo en diferentes espacios o llevarlo de un lugar a otro.';

const dummyProducts: ProductEntity[] = [
  {
    id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
    name: 'Audífonos inalámbricos',
    description: headphonesDescription,
    currency: 'COP',
    priceCents: 12990000,
    stock: 12,
  },
  {
    id: '3685f095-a601-4ca6-ab54-0f8eb66bccd8',
    name: 'Parlante portátil',
    description: speakerDescription,
    currency: 'COP',
    priceCents: 7990000,
    stock: 8,
  },
];

export async function seed(dataSource = createDataSource()): Promise<void> {
  try {
    await dataSource.initialize();
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(ProductEntity)
      .values(dummyProducts)
      .orIgnore()
      .execute();
    const products = dataSource.getRepository(ProductEntity);
    await products.update(
      {
        id: dummyProducts[0].id,
        name: 'Wireless Headphones',
        description: 'Over-ear wireless headphones',
      },
      {
        name: dummyProducts[0].name,
        description: headphonesDescription,
      },
    );
    await products.update(
      {
        id: dummyProducts[1].id,
        name: 'Portable Speaker',
        description: 'Compact Bluetooth speaker',
      },
      {
        name: dummyProducts[1].name,
        description: speakerDescription,
      },
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  void seed().catch((error: unknown) => {
    console.error('Database seed failed', { code: getErrorCode(error) });
    process.exitCode = 1;
  });
}

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
