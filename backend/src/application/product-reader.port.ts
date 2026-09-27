import type { Product } from '../domain/product';

export interface ProductReader {
  findById(id: string): Promise<Product | null>;
}
