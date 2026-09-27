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
  | 'PENDING'
  | 'SUBMISSION_UNKNOWN'
  | 'SUBMISSION_REJECTED'
  | 'APPROVED'
  | 'DECLINED'
  | 'VOIDED'
  | 'ERROR';

export type FinalPaymentStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export type FulfillmentStatus = 'NOT_STARTED' | 'CREATED' | 'STOCK_UNAVAILABLE';

export function isFinalPaymentStatus(
  status: PaymentStatus,
): status is FinalPaymentStatus {
  return (
    status === 'APPROVED' ||
    status === 'DECLINED' ||
    status === 'VOIDED' ||
    status === 'ERROR'
  );
}

export function paymentTransition(
  current: PaymentStatus,
  confirmed: FinalPaymentStatus | 'PENDING',
): 'APPLY' | 'REPLAY' | 'STALE' | 'CONFLICT' {
  if (isFinalPaymentStatus(current)) {
    if (confirmed === 'PENDING') return 'STALE';
    return current === confirmed ? 'REPLAY' : 'CONFLICT';
  }
  return 'APPLY';
}

export type PricingFailure =
  'INVALID_INPUT' | 'INSUFFICIENT_STOCK' | 'UNSUPPORTED_CURRENCY';

export type PricingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: PricingFailure };
