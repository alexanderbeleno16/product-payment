import { Module } from '@nestjs/common';
import { GetProduct } from './application/get-product';
import type { ProductReader } from './application/product-reader.port';
import { createDataSource } from './infrastructure/persistence/data-source';
import { TypeOrmProductReader } from './infrastructure/persistence/typeorm-product.reader';
import { ProductsController } from './products.controller';

export const PRODUCT_READER = Symbol('PRODUCT_READER');

@Module({
  controllers: [ProductsController],
  providers: [
    {
      provide: PRODUCT_READER,
      useFactory: async (): Promise<TypeOrmProductReader> => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        return new TypeOrmProductReader(dataSource);
      },
    },
    {
      provide: GetProduct,
      useFactory: (products: ProductReader): GetProduct =>
        new GetProduct(products),
      inject: [PRODUCT_READER],
    },
  ],
})
export class ProductsModule {}
