import { Test } from '@nestjs/testing';
import { CheckoutController } from './adapters/inbound/http/checkout.controller';
import { SandboxConsentTermsReader } from './adapters/outbound/payment/sandbox-consent-terms.reader';
import { SandboxPaymentGateway } from './adapters/outbound/payment/sandbox-payment.gateway';
import { SandboxPaymentStatusReader } from './adapters/outbound/payment/sandbox-payment-status.reader';
import { PaymentEventController } from './adapters/inbound/http/payment-event.controller';
import { PaymentEventVerifier } from './adapters/inbound/http/payment-event.verifier';
import { ReceivePaymentEvent } from './application/receive-payment-event';
import { ReconcileKnownPayment } from './application/reconcile-known-payment';
import { FinalizeVerifiedPayment } from './application/finalize-verified-payment';
import { DatabaseConnection } from './adapters/outbound/persistence/database-connection';
import { TypeOrmCheckoutStore } from './adapters/outbound/persistence/typeorm-checkout.store';
import { GetTransactionStatus } from './application/get-transaction-status';
import { InitiatePayment } from './application/initiate-payment';
import { QuoteCheckout } from './application/quote-checkout';
import { StartCheckout } from './application/start-checkout';
import { AppModule } from './app.module';
import { CHECKOUT_STORE } from './checkout.module';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from './checkout.tokens';

const fakeConfiguration = {
  PAYMENT_API_BASE_URL: 'https://sandbox.invalid/v1',
  PAYMENT_SANDBOX_HOST: 'sandbox.invalid',
  PAYMENT_PRIVATE_KEY: 'prv_test_unit_fixture',
  PAYMENT_INTEGRITY_SECRET: 'test_integrity_unit_fixture',
  PAYMENT_PUBLIC_KEY: 'pub_test_unit_fixture',
  PAYMENT_EVENTS_SECRET: 'test_events_unit_fixture',
};

describe('Nest checkout composition', () => {
  beforeEach(() => Object.assign(process.env, fakeConfiguration));
  afterEach(() => {
    for (const name of Object.keys(fakeConfiguration)) delete process.env[name];
  });

  it('binds checkout use cases to outbound adapters without connecting to a database or provider', async () => {
    const databaseCall = jest
      .spyOn(DatabaseConnection.prototype, 'get')
      .mockRejectedValue(new Error('Unexpected database access'));
    const providerCall = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected provider access'));
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      try {
        expect(moduleRef.get(CheckoutController)).toBeInstanceOf(
          CheckoutController,
        );
        expect(moduleRef.get(QuoteCheckout)).toBeInstanceOf(QuoteCheckout);
        expect(moduleRef.get(StartCheckout)).toBeInstanceOf(StartCheckout);
        expect(moduleRef.get(InitiatePayment)).toBeInstanceOf(InitiatePayment);
        expect(moduleRef.get(GetTransactionStatus)).toBeInstanceOf(
          GetTransactionStatus,
        );
        expect(moduleRef.get(PaymentEventController)).toBeInstanceOf(
          PaymentEventController,
        );
        expect(moduleRef.get(PaymentEventVerifier)).toBeInstanceOf(
          PaymentEventVerifier,
        );
        expect(moduleRef.get(ReceivePaymentEvent)).toBeInstanceOf(
          ReceivePaymentEvent,
        );
        expect(moduleRef.get(ReconcileKnownPayment)).toBeInstanceOf(
          ReconcileKnownPayment,
        );
        expect(moduleRef.get(FinalizeVerifiedPayment)).toBeInstanceOf(
          FinalizeVerifiedPayment,
        );
        expect(moduleRef.get(PAYMENT_STATUS_READER)).toBeInstanceOf(
          SandboxPaymentStatusReader,
        );
        expect(moduleRef.get(CHECKOUT_STORE)).toBeInstanceOf(
          TypeOrmCheckoutStore,
        );
        expect(moduleRef.get(PAYMENT_GATEWAY)).toBeInstanceOf(
          SandboxPaymentGateway,
        );
        expect(moduleRef.get(CONSENT_TERMS_READER)).toBeInstanceOf(
          SandboxConsentTermsReader,
        );
        expect(databaseCall).not.toHaveBeenCalled();
        expect(providerCall).not.toHaveBeenCalled();
      } finally {
        await moduleRef.close();
      }
    } finally {
      databaseCall.mockRestore();
      providerCall.mockRestore();
    }
  });

  it('fails startup when a required sandbox secret is absent', async () => {
    delete process.env.PAYMENT_INTEGRITY_SECRET;

    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(
      'Missing required payment configuration: PAYMENT_INTEGRITY_SECRET',
    );
  });
});
