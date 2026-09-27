import type { DataSource, Repository } from 'typeorm';
import type { DatabaseConnection } from './database-connection';
import { ProductEntity } from './product.entity';
import { TypeOrmProductReader } from './typeorm-product.reader';

const id = '8a52ea31-08d9-4f52-a604-00e56143dce0';

describe('TypeOrmProductReader', () => {
  const findOneBy = jest.fn();
  const getRepository = jest
    .fn()
    .mockReturnValue({ findOneBy } as Pick<
      Repository<ProductEntity>,
      'findOneBy'
    >);
  const dataSource = {
    getRepository,
  } as unknown as DataSource;
  const connection = {
    get: jest.fn().mockResolvedValue(dataSource),
  } as unknown as DatabaseConnection;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a persistence record to a plain product', async () => {
    findOneBy.mockResolvedValue({
      id,
      name: 'Wireless Headphones',
      description: 'Over-ear wireless headphones',
      currency: 'COP',
      priceCents: 12990000,
      stock: 12,
    } satisfies ProductEntity);

    await expect(
      new TypeOrmProductReader(connection).findById(id),
    ).resolves.toEqual({
      id,
      name: 'Wireless Headphones',
      description: 'Over-ear wireless headphones',
      currency: 'COP',
      priceCents: 12990000,
      stock: 12,
    });
    expect(getRepository).toHaveBeenCalledWith(ProductEntity);
    expect(findOneBy).toHaveBeenCalledWith({ id });
  });

  it('returns null for a missing persistence record', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(
      new TypeOrmProductReader(connection).findById(id),
    ).resolves.toBeNull();
  });
});
