import type { Product } from './product';

export interface ProductReader {
  findById(id: string): Promise<Product | null>;
}
