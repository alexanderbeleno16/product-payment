import { Module } from '@nestjs/common';
import { GetProduct } from './application/get-product';
import type { ProductReader } from './application/product-reader.port';
import { DatabaseConnection } from './infrastructure/persistence/database-connection';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { TypeOrmProductReader } from './infrastructure/persistence/typeorm-product.reader';
import { ProductsController } from './products.controller';

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
  ],
  exports: [PRODUCT_READER],
})
export class ProductsModule {}
