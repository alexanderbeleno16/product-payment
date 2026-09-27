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
    expect(insertQuery.values).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Audífonos inalámbricos' }),
      expect.objectContaining({ name: 'Parlante portátil' }),
    ]);
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
