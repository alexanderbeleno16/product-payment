import type { Product } from '../domain/product';

export interface ProductReader {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
}
