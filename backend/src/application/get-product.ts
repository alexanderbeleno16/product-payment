import type { Product } from './product';
import type { ProductReader } from './product-reader.port';

export class GetProduct {
  constructor(private readonly products: ProductReader) {}

  execute(id: string): Promise<Product | null> {
    return this.products.findById(id);
  }
}
