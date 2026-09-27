import type { Product } from '../domain/product';
import type { ProductReader } from './product-reader.port';

export class ListProducts {
  constructor(private readonly products: ProductReader) {}

  execute(): Promise<Product[]> {
    return this.products.findAll();
  }
}
