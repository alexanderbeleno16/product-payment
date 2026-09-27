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

export type PricingFailure =
  'INVALID_INPUT' | 'INSUFFICIENT_STOCK' | 'UNSUPPORTED_CURRENCY';

export type PricingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: PricingFailure };
