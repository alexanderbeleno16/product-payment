import type { DataSource } from 'typeorm';
import { ProductEntity } from './product.entity';
import { seed } from './seed';

describe('seed', () => {
  it('updates only unchanged legacy demo rows while leaving stock outside the update', async () => {
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const destroy = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      isInitialized: true,
      initialize: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(insertQuery),
      getRepository: jest.fn().mockReturnValue({ update }),
      destroy,
    } as unknown as DataSource;

    await seed(dataSource);

    expect(insertQuery.into).toHaveBeenCalledWith(ProductEntity);
    expect(insertQuery.orIgnore).toHaveBeenCalledTimes(1);
    const inserted = insertQuery.values.mock.calls[0][0] as ProductEntity[];
    expect(inserted).toHaveLength(10);
    expect(new Set(inserted.map((product) => product.id)).size).toBe(10);
    expect(inserted.map((product) => product.id)).toEqual([
      '8a52ea31-08d9-4f52-a604-00e56143dce0',
      '3685f095-a601-4ca6-ab54-0f8eb66bccd8',
      '9b135df6-299a-43c1-a33f-6f3a0fc9281a',
      'ee4216cd-55e7-42c1-9c25-398c385955ad',
      'aa6cc46a-7dd1-4f36-a884-8e75088851b9',
      '79e9bec3-9a34-43fe-a5d4-b11e22f20f89',
      '19777d45-8fe4-4a48-ba25-ff41b30c5816',
      '934c2c27-f973-43a1-b6e1-3feb06800c0c',
      '2f5bea3c-9169-4172-a395-6afa0448009a',
      '14746114-cb12-446c-8386-3c7bce2bd966',
    ]);
    expect(inserted.map((product) => product.name)).toEqual([
      'Audífonos inalámbricos',
      'Parlante portátil',
      'Mochila urbana negra',
      'Billetera compacta de cuero marrón',
      'Termo de viaje de acero oscuro',
      'Ratón inalámbrico gris grafito',
      'Lámpara de escritorio LED negra',
      'Teclado mecánico compacto gris oscuro',
      'Batería externa portátil negra',
      'Soporte plegable para teléfono gris',
    ]);
    expect(inserted.map((product) => product.priceCents)).toEqual([
      12_990_000, 7_990_000, 15_990_000, 6_990_000, 8_490_000, 5_990_000,
      11_990_000, 18_990_000, 10_990_000, 3_990_000,
    ]);
    expect(inserted.map((product) => product.stock)).toEqual([
      12, 8, 14, 22, 18, 16, 11, 9, 13, 24,
    ]);
    for (const product of inserted) {
      expect(product.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(product.currency).toBe('COP');
      expect(product.description.length).toBeGreaterThan(100);
    }
    expect(update).toHaveBeenNthCalledWith(
      1,
      {
        id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
        name: 'Wireless Headphones',
        description: 'Over-ear wireless headphones',
      },
      {
        name: 'Audífonos inalámbricos',
        description: expect.stringContaining(
          'Audífonos inalámbricos de diadema',
        ),
      },
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      {
        id: '3685f095-a601-4ca6-ab54-0f8eb66bccd8',
        name: 'Portable Speaker',
        description: 'Compact Bluetooth speaker',
      },
      {
        name: 'Parlante portátil',
        description: expect.stringContaining('Parlante portátil compacto'),
      },
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
