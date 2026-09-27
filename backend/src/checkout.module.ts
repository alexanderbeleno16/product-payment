import { Module } from '@nestjs/common';
import type { CheckoutStore } from './application/checkout-store.port';
import { QuoteCheckout } from './application/quote-checkout';
import { StartCheckout } from './application/start-checkout';
import type { ProductReader } from './application/product-reader.port';
import { DatabaseConnection } from './adapters/outbound/persistence/database-connection';
import { DatabaseModule } from './adapters/outbound/persistence/database.module';
import { TypeOrmCheckoutStore } from './adapters/outbound/persistence/typeorm-checkout.store';
import { PRODUCT_READER, ProductsModule } from './products.module';

export const CHECKOUT_STORE = Symbol('CHECKOUT_STORE');

@Module({
  imports: [DatabaseModule, ProductsModule],
  providers: [
    {
      provide: CHECKOUT_STORE,
      useFactory: (connection: DatabaseConnection): CheckoutStore =>
        new TypeOrmCheckoutStore(connection),
      inject: [DatabaseConnection],
    },
    {
      provide: QuoteCheckout,
      useFactory: (products: ProductReader): QuoteCheckout =>
        new QuoteCheckout(products),
      inject: [PRODUCT_READER],
    },
    {
      provide: StartCheckout,
      useFactory: (
        products: ProductReader,
        store: CheckoutStore,
      ): StartCheckout => new StartCheckout(products, store),
      inject: [PRODUCT_READER, CHECKOUT_STORE],
    },
  ],
  exports: [CHECKOUT_STORE, QuoteCheckout, StartCheckout],
})
export class CheckoutModule {}
