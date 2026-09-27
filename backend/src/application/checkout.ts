import type {
  CheckoutQuote,
  PaymentStatus,
  PricingFailure,
} from '../domain/checkout';

export interface DeliveryDetails {
  readonly recipientName: string;
  readonly addressLine: string;
  readonly city: string;
}

export interface CheckoutInput {
  readonly idempotencyKey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly customerEmail: string;
  readonly delivery: DeliveryDetails;
}

export interface CheckoutTransaction extends CheckoutQuote {
  readonly id: string;
  readonly reference: string;
  readonly customerId: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: PaymentStatus;
  readonly submissionStartedAt: Date | null;
  readonly providerTransactionId: string | null;
  readonly createdAt: Date;
}

export type CheckoutFailure =
  PricingFailure | 'PRODUCT_NOT_FOUND' | 'IDEMPOTENCY_CONFLICT';

export type CheckoutResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: CheckoutFailure };
