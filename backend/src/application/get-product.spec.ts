import { GetProduct } from './get-product';
import type { Product } from '../domain/product';
import type { ProductReader } from './product-reader.port';

const product: Product = {
  id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP',
  priceCents: 12990000,
  stock: 12,
};

describe('GetProduct', () => {
  it('returns trusted product and stock from the reader', async () => {
    const findById = jest.fn().mockResolvedValue(product);
    const reader: ProductReader = { findById };
    const useCase = new GetProduct(reader);

    await expect(useCase.execute(product.id)).resolves.toEqual(product);
    expect(findById).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledWith(product.id);
  });

  it('returns null when the product is missing', async () => {
    const reader: ProductReader = {
      findById: jest.fn().mockResolvedValue(null),
    };

    await expect(
      new GetProduct(reader).execute(product.id),
    ).resolves.toBeNull();
  });
});
