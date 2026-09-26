import type { DataSource } from 'typeorm';
import type { Product } from '../../application/product';
import type { ProductReader } from '../../application/product-reader.port';
import { ProductEntity } from './product.entity';

export class TypeOrmProductReader implements ProductReader {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: string): Promise<Product | null> {
    const entity = await this.dataSource
      .getRepository(ProductEntity)
      .findOneBy({ id });

    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      currency: entity.currency,
      priceCents: entity.priceCents,
      stock: entity.stock,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
