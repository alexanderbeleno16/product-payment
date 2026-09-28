import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CheckoutFailure,
  CheckoutTransaction,
} from '../../../application/checkout';
import type { ConsentTermsReader } from '../../../application/consent-terms.port';
import { ConsentTermsUnavailable } from '../../../application/consent-terms.port';
import { GetTransactionStatus } from '../../../application/get-transaction-status';
import { InitiatePayment } from '../../../application/initiate-payment';
import { QuoteCheckout } from '../../../application/quote-checkout';
import { CheckoutController } from './checkout.controller';
import type {
  CreateCheckoutDto,
  QuoteQueryDto,
  TransactionReferenceDto,
} from './checkout.dto';

const productId = '8a52ea31-08d9-4f52-a604-00e56143dce0';
const idempotencyKey = 'cf2cdd86-05ea-4c7c-adeb-812927f37873';
const reference = 'txn_511da8e3-4a22-430a-83f6-e8729df28679';
const quote = {
  productId,
  quantity: 2,
  currency: 'COP' as const,
  unitPriceCents: 1_000_000,
  productAmountCents: 2_000_000,
  baseFeeCents: 200_000,
  deliveryFeeCents: 500_000,
  totalCents: 2_700_000,
};
const checkout: CheckoutTransaction = {
  ...quote,
  id: '46d6a4ce-a557-4ce0-9279-c96de7bfbd2f',
  reference,
  customerId: 'fd26f82a-4c55-4381-86f5-2b318298bb02',
  idempotencyKey,
  requestFingerprint: 'private-fingerprint',
  status: 'PENDING',
  fulfillmentStatus: 'NOT_STARTED',
  submissionStartedAt: null,
  providerTransactionId: null,
  createdAt: new Date('2026-09-26T00:00:00.000Z'),
};
const body: CreateCheckoutDto = {
  productId,
  quantity: 2,
  expectedTotalCents: 2_700_000,
  installments: 3,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
  cardToken: 'ephemeral-card-token',
  acceptanceToken: 'ephemeral-policy-token',
  personalDataToken: 'ephemeral-privacy-token',
  acceptsEndUserPolicy: true,
  acceptsPersonalDataAuthorization: true,
};

function controllerWithFakes() {
  const quoteCheckout = { execute: jest.fn() };
  const initiatePayment = { execute: jest.fn() };
  const getTransactionStatus = { execute: jest.fn() };
  const consentTerms = { getCurrent: jest.fn() };
  const controller = new CheckoutController(
    quoteCheckout as unknown as QuoteCheckout,
    initiatePayment as unknown as InitiatePayment,
    getTransactionStatus as unknown as GetTransactionStatus,
    consentTerms as unknown as ConsentTermsReader,
  );
  return {
    controller,
    quoteCheckout,
    initiatePayment,
    getTransactionStatus,
    consentTerms,
  };
}

describe('CheckoutController HTTP mapping', () => {
  it('returns only server-owned quote fields', async () => {
    const { controller, quoteCheckout } = controllerWithFakes();
    quoteCheckout.execute.mockResolvedValue({
      ok: true,
      value: { ...quote, internal: 'hidden' },
    });

    await expect(
      controller.quote({ productId, quantity: 2 } as QuoteQueryDto),
    ).resolves.toEqual(quote);
    expect(quoteCheckout.execute).toHaveBeenCalledWith(productId, 2);
  });

  it.each<[CheckoutFailure, new (...args: never[]) => Error]>([
    ['INVALID_INPUT', BadRequestException],
    ['PRODUCT_NOT_FOUND', NotFoundException],
    ['INSUFFICIENT_STOCK', ConflictException],
    ['IDEMPOTENCY_CONFLICT', ConflictException],
    ['QUOTE_CHANGED', ConflictException],
    ['UNSUPPORTED_CURRENCY', UnprocessableEntityException],
  ])(
    'maps %s to an explicit safe HTTP exception',
    async (reason, exceptionType) => {
      const { controller, quoteCheckout } = controllerWithFakes();
      quoteCheckout.execute.mockResolvedValue({ ok: false, reason });

      await expect(
        controller.quote({ productId, quantity: 2 } as QuoteQueryDto),
      ).rejects.toBeInstanceOf(exceptionType);
    },
  );

  it('returns only the public key and current consent documents', async () => {
    const { controller, consentTerms } = controllerWithFakes();
    const terms = {
      publicKey: 'pub_test_example',
      endUserPolicy: {
        token: 'policy-token',
        permalink: 'https://example.invalid/policy',
      },
      personalDataAuthorization: {
        token: 'privacy-token',
        permalink: 'https://example.invalid/privacy',
      },
    };
    consentTerms.getCurrent.mockResolvedValue(terms);

    await expect(controller.consents()).resolves.toEqual(terms);
  });

  it('does not expose provider failure details when consent retrieval fails', async () => {
    const { controller, consentTerms } = controllerWithFakes();
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    consentTerms.getCurrent.mockRejectedValue(
      new ConsentTermsUnavailable('auth'),
    );

    await expect(controller.consents()).rejects.toThrow(
      new ServiceUnavailableException(
        'Consent terms are temporarily unavailable',
      ),
    );
    expect(warning).toHaveBeenCalledWith('Consent terms unavailable: auth');
    consentTerms.getCurrent.mockRejectedValueOnce(
      new Error('sensitive upstream response'),
    );
    await expect(controller.consents()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(warning).toHaveBeenLastCalledWith(
      'Consent terms unavailable: unexpected',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain('sensitive');
    warning.mockRestore();
  });

  it('passes only checkout intent and transient credentials to the use case and redacts the response', async () => {
    const { controller, initiatePayment } = controllerWithFakes();
    initiatePayment.execute.mockResolvedValue({ ok: true, value: checkout });

    await expect(controller.create(idempotencyKey, body)).resolves.toEqual({
      reference,
      status: 'PENDING',
      quote,
    });
    expect(initiatePayment.execute).toHaveBeenCalledWith(
      {
        idempotencyKey,
        productId,
        quantity: 2,
        expectedTotalCents: body.expectedTotalCents,
        installments: 3,
        customerEmail: body.customerEmail,
        delivery: body.delivery,
      },
      {
        cardToken: body.cardToken,
        acceptanceToken: body.acceptanceToken,
        personalDataToken: body.personalDataToken,
      },
      { acceptsEndUserPolicy: true, acceptsPersonalDataAuthorization: true },
    );
  });

  it('returns only reference and local status when the key matches', async () => {
    const { controller, getTransactionStatus } = controllerWithFakes();
    getTransactionStatus.execute.mockResolvedValue({
      ok: true,
      value: {
        reference,
        paymentStatus: 'SUBMISSION_UNKNOWN',
        fulfillmentStatus: 'NOT_STARTED',
      },
    });

    await expect(
      controller.status(
        { reference } as TransactionReferenceDto,
        idempotencyKey,
      ),
    ).resolves.toEqual({
      reference,
      paymentStatus: 'SUBMISSION_UNKNOWN',
      fulfillmentStatus: 'NOT_STARTED',
    });
    expect(getTransactionStatus.execute).toHaveBeenCalledWith(
      reference,
      idempotencyKey,
    );
  });

  it('does not disclose whether a reference exists when the key does not identify it', async () => {
    const { controller, getTransactionStatus } = controllerWithFakes();
    getTransactionStatus.execute.mockResolvedValue({
      ok: false,
      reason: 'NOT_FOUND',
    });

    await expect(
      controller.status(
        { reference } as TransactionReferenceDto,
        idempotencyKey,
      ),
    ).rejects.toThrow(new NotFoundException('Transaction not found'));
  });
});
