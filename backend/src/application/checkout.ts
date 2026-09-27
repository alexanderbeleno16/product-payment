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

export interface CheckoutQuote {
  readonly productId: string;
  readonly quantity: number;
  readonly currency: 'COP';
  readonly unitPriceCents: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
}

export type PaymentStatus =
  'PENDING' | 'SUBMISSION_UNKNOWN' | 'APPROVED' | 'DECLINED' | 'ERROR';

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
  | 'INVALID_INPUT'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'UNSUPPORTED_CURRENCY'
  | 'IDEMPOTENCY_CONFLICT';

export type CheckoutResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: CheckoutFailure };
