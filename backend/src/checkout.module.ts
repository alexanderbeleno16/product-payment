import { Module } from '@nestjs/common';
import type { CheckoutStore } from './application/checkout-store.port';
import type { ConsentTermsReader } from './application/consent-terms.port';
import { GetTransactionStatus } from './application/get-transaction-status';
import { InitiatePayment } from './application/initiate-payment';
import type { PaymentGateway } from './application/payment-gateway.port';
import { QuoteCheckout } from './application/quote-checkout';
import { StartCheckout } from './application/start-checkout';
import { FinalizeVerifiedPayment } from './application/finalize-verified-payment';
import type { PaymentStatusReader } from './application/payment-status-reader.port';
import { ReceivePaymentEvent } from './application/receive-payment-event';
import type { ProductReader } from './application/product-reader.port';
import { CheckoutController } from './adapters/inbound/http/checkout.controller';
import { PaymentEventController } from './adapters/inbound/http/payment-event.controller';
import { PaymentEventVerifier } from './adapters/inbound/http/payment-event.verifier';
import { DatabaseConnection } from './adapters/outbound/persistence/database-connection';
import { DatabaseModule } from './adapters/outbound/persistence/database.module';
import { TypeOrmCheckoutStore } from './adapters/outbound/persistence/typeorm-checkout.store';
import { TypeOrmFinalizationStore } from './adapters/outbound/persistence/typeorm-finalization.store';
import { SandboxConsentTermsReader } from './adapters/outbound/payment/sandbox-consent-terms.reader';
import { SandboxPaymentGateway } from './adapters/outbound/payment/sandbox-payment.gateway';
import { SandboxPaymentStatusReader } from './adapters/outbound/payment/sandbox-payment-status.reader';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from './checkout.tokens';
import { PRODUCT_READER, ProductsModule } from './products.module';

export const CHECKOUT_STORE = Symbol('CHECKOUT_STORE');

function requiredPaymentEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required payment configuration: ${name}`);
  return value;
}

@Module({
  imports: [DatabaseModule, ProductsModule],
  controllers: [CheckoutController, PaymentEventController],
  providers: [
    {
      provide: FinalizeVerifiedPayment,
      useFactory: (connection: DatabaseConnection): FinalizeVerifiedPayment =>
        new FinalizeVerifiedPayment(new TypeOrmFinalizationStore(connection)),
      inject: [DatabaseConnection],
    },
    {
      provide: PAYMENT_STATUS_READER,
      useFactory: (): PaymentStatusReader =>
        new SandboxPaymentStatusReader({
          apiBaseUrl: requiredPaymentEnv('PAYMENT_API_BASE_URL'),
          expectedSandboxHost: requiredPaymentEnv('PAYMENT_SANDBOX_HOST'),
          privateKey: requiredPaymentEnv('PAYMENT_PRIVATE_KEY'),
        }),
    },
    {
      provide: PaymentEventVerifier,
      useFactory: (): PaymentEventVerifier =>
        new PaymentEventVerifier(requiredPaymentEnv('PAYMENT_EVENTS_SECRET')),
    },
    {
      provide: ReceivePaymentEvent,
      useFactory: (
        reader: PaymentStatusReader,
        finalization: FinalizeVerifiedPayment,
      ): ReceivePaymentEvent => new ReceivePaymentEvent(reader, finalization),
      inject: [PAYMENT_STATUS_READER, FinalizeVerifiedPayment],
    },
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
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (): PaymentGateway =>
        new SandboxPaymentGateway({
          apiBaseUrl: requiredPaymentEnv('PAYMENT_API_BASE_URL'),
          expectedSandboxHost: requiredPaymentEnv('PAYMENT_SANDBOX_HOST'),
          privateKey: requiredPaymentEnv('PAYMENT_PRIVATE_KEY'),
          integritySecret: requiredPaymentEnv('PAYMENT_INTEGRITY_SECRET'),
        }),
    },
    {
      provide: CONSENT_TERMS_READER,
      useFactory: (): ConsentTermsReader =>
        new SandboxConsentTermsReader({
          apiBaseUrl: requiredPaymentEnv('PAYMENT_API_BASE_URL'),
          expectedSandboxHost: requiredPaymentEnv('PAYMENT_SANDBOX_HOST'),
          publicKey: requiredPaymentEnv('PAYMENT_PUBLIC_KEY'),
        }),
    },
    {
      provide: InitiatePayment,
      useFactory: (
        startCheckout: StartCheckout,
        store: CheckoutStore,
        gateway: PaymentGateway,
      ): InitiatePayment => new InitiatePayment(startCheckout, store, gateway),
      inject: [StartCheckout, CHECKOUT_STORE, PAYMENT_GATEWAY],
    },
    {
      provide: GetTransactionStatus,
      useFactory: (store: CheckoutStore): GetTransactionStatus =>
        new GetTransactionStatus(store),
      inject: [CHECKOUT_STORE],
    },
  ],
  exports: [CHECKOUT_STORE, QuoteCheckout, StartCheckout],
})
export class CheckoutModule {}
