import type { Product } from '../../../domain/product';
import type { ProductReader } from '../../../application/product-reader.port';
import { DatabaseConnection } from './database-connection';
import { ProductEntity } from './product.entity';

export class TypeOrmProductReader implements ProductReader {
  constructor(private readonly connection: DatabaseConnection) {}

  async findAll(): Promise<Product[]> {
    const dataSource = await this.connection.get();
    const entities = await dataSource.getRepository(ProductEntity).find({
      order: { name: 'ASC', id: 'ASC' },
    });
    return entities.map((entity) => this.toProduct(entity));
  }

  async findById(id: string): Promise<Product | null> {
    const dataSource = await this.connection.get();
    const entity = await dataSource
      .getRepository(ProductEntity)
      .findOneBy({ id });

    if (!entity) {
      return null;
    }

    return this.toProduct(entity);
  }

  private toProduct(entity: ProductEntity): Product {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      currency: entity.currency,
      priceCents: entity.priceCents,
      stock: entity.stock,
    };
  }
}
