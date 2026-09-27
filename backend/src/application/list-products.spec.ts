import { ListProducts } from './list-products';
import type { ProductReader } from './product-reader.port';

describe('ListProducts', () => {
  it('returns the reader result without changing server-owned fields', async () => {
    const products = [
      {
        id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
        name: 'Wireless Headphones',
        description: 'Audífonos inalámbricos de diadema.',
        currency: 'COP',
        priceCents: 12990000,
        stock: 12,
      },
    ];
    const findAll = jest.fn().mockResolvedValue(products);
    const findById = jest.fn();
    const reader: ProductReader = { findAll, findById };

    await expect(new ListProducts(reader).execute()).resolves.toBe(products);
    expect(findAll).toHaveBeenCalledTimes(1);
    expect(findById).not.toHaveBeenCalled();
  });

  it('returns an empty catalog without treating it as an error', async () => {
    const reader: ProductReader = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
    };

    await expect(new ListProducts(reader).execute()).resolves.toEqual([]);
  });
});
