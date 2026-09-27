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
  {
    id: '9b135df6-299a-43c1-a33f-6f3a0fc9281a',
    name: 'Mochila urbana negra',
    description:
      'Mochila urbana negra para llevar objetos personales en los desplazamientos del día a día. Su apariencia discreta resulta práctica para combinar con ropa de trabajo, estudio o tiempo libre.',
    currency: 'COP',
    priceCents: 15_990_000,
    stock: 14,
  },
  {
    id: 'ee4216cd-55e7-42c1-9c25-398c385955ad',
    name: 'Billetera compacta de cuero marrón',
    description:
      'Billetera compacta de cuero en tono marrón para llevar tarjetas, billetes y documentos pequeños. Su formato sencillo facilita guardarla en un bolsillo o dentro de un bolso.',
    currency: 'COP',
    priceCents: 6_990_000,
    stock: 22,
  },
  {
    id: 'aa6cc46a-7dd1-4f36-a884-8e75088851b9',
    name: 'Termo de viaje de acero oscuro',
    description:
      'Termo de viaje de acero con acabado oscuro, pensado para transportar una bebida durante la jornada. Su formato portátil permite llevarlo al escritorio o en una salida cotidiana.',
    currency: 'COP',
    priceCents: 8_490_000,
    stock: 18,
  },
  {
    id: '79e9bec3-9a34-43fe-a5d4-b11e22f20f89',
    name: 'Ratón inalámbrico gris grafito',
    description:
      'Ratón inalámbrico de acabado gris grafito para acompañar una estación de trabajo o estudio. Su diseño compacto ayuda a mantener el escritorio despejado y permite moverlo con facilidad.',
    currency: 'COP',
    priceCents: 5_990_000,
    stock: 16,
  },
  {
    id: '19777d45-8fe4-4a48-ba25-ff41b30c5816',
    name: 'Lámpara de escritorio LED negra',
    description:
      'Lámpara de escritorio LED en color negro para añadir luz a una zona de lectura o trabajo. Su aspecto sobrio se integra en espacios de estudio y oficinas domésticas.',
    currency: 'COP',
    priceCents: 11_990_000,
    stock: 11,
  },
  {
    id: '934c2c27-f973-43a1-b6e1-3feb06800c0c',
    name: 'Teclado mecánico compacto gris oscuro',
    description:
      'Teclado mecánico compacto en gris oscuro para un espacio de trabajo con menos volumen sobre la mesa. Su presentación sencilla está orientada a escritura y uso cotidiano del computador.',
    currency: 'COP',
    priceCents: 18_990_000,
    stock: 9,
  },
  {
    id: '2f5bea3c-9169-4172-a395-6afa0448009a',
    name: 'Batería externa portátil negra',
    description:
      'Batería externa portátil de color negro para llevar energía adicional cuando se está lejos de un tomacorriente. Su formato facilita guardarla junto a los accesorios habituales de viaje.',
    currency: 'COP',
    priceCents: 10_990_000,
    stock: 13,
  },
  {
    id: '14746114-cb12-446c-8386-3c7bce2bd966',
    name: 'Soporte plegable para teléfono gris',
    description:
      'Soporte plegable de color gris para ubicar un teléfono sobre la mesa mientras se consultan mensajes o contenidos. Puede guardarse sin ocupar mucho espacio al terminar de usarlo.',
    currency: 'COP',
    priceCents: 3_990_000,
    stock: 24,
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
