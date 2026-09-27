import { NotFoundException } from '@nestjs/common';
import { GetProduct } from '../../../application/get-product';
import { ListProducts } from '../../../application/list-products';
import type { Product } from '../../../domain/product';
import { ProductsController } from './products.controller';

const product: Product = {
  id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP',
  priceCents: 12990000,
  stock: 12,
};

describe('ProductsController', () => {
  const listProducts = { execute: jest.fn() };

  it('returns the use-case result without changing price or stock', async () => {
    const getProduct = { execute: jest.fn().mockResolvedValue(product) };
    const controller = new ProductsController(
      getProduct as unknown as GetProduct,
      listProducts as unknown as ListProducts,
    );

    await expect(controller.findById(product.id)).resolves.toEqual(product);
    expect(getProduct.execute).toHaveBeenCalledWith(product.id);
  });

  it('maps absent products to a safe 404', async () => {
    const getProduct = { execute: jest.fn().mockResolvedValue(null) };
    const controller = new ProductsController(
      getProduct as unknown as GetProduct,
      listProducts as unknown as ListProducts,
    );

    await expect(controller.findById(product.id)).rejects.toThrow(
      new NotFoundException('Product not found'),
    );
  });

  it('lists the server-owned products through the use case', async () => {
    const getProduct = { execute: jest.fn() };
    listProducts.execute.mockResolvedValue([product]);
    const controller = new ProductsController(
      getProduct as unknown as GetProduct,
      listProducts as unknown as ListProducts,
    );

    await expect(controller.list()).resolves.toEqual([product]);
    expect(listProducts.execute).toHaveBeenCalledTimes(1);
    expect(getProduct.execute).not.toHaveBeenCalled();
  });
});
