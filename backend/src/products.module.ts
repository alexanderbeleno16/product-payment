import { Module } from '@nestjs/common';
import { GetProduct } from './application/get-product';
import { ListProducts } from './application/list-products';
import type { ProductReader } from './application/product-reader.port';
import { DatabaseConnection } from './adapters/outbound/persistence/database-connection';
import { DatabaseModule } from './adapters/outbound/persistence/database.module';
import { TypeOrmProductReader } from './adapters/outbound/persistence/typeorm-product.reader';
import { ProductsController } from './adapters/inbound/http/products.controller';

export const PRODUCT_READER = Symbol('PRODUCT_READER');

@Module({
  imports: [DatabaseModule],
  controllers: [ProductsController],
  providers: [
    {
      provide: PRODUCT_READER,
      useFactory: (connection: DatabaseConnection): TypeOrmProductReader =>
        new TypeOrmProductReader(connection),
      inject: [DatabaseConnection],
    },
    {
      provide: GetProduct,
      useFactory: (products: ProductReader): GetProduct =>
        new GetProduct(products),
      inject: [PRODUCT_READER],
    },
    {
      provide: ListProducts,
      useFactory: (products: ProductReader): ListProducts =>
        new ListProducts(products),
      inject: [PRODUCT_READER],
    },
  ],
  exports: [PRODUCT_READER],
})
export class ProductsModule {}
