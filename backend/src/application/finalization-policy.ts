import {
  isFinalPaymentStatus,
  paymentTransition,
  type FulfillmentStatus,
  type PaymentStatus,
} from '../domain/checkout';
import type {
  FinalizationResult,
  VerifiedPaymentSnapshot,
} from './finalize-verified-payment';

/** Local facts read under the transaction row lock, not an ORM entity. */
export interface FinalizationState {
  readonly reference: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly providerTransactionId: string | null;
  readonly submissionStarted: boolean;
  readonly paymentStatus: PaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;
}

export type FinalizationDecision =
  | { readonly kind: 'RETURN'; readonly result: FinalizationResult }
  | { readonly kind: 'APPLY'; readonly needsStock: boolean };

export function decideFinalization(
  state: FinalizationState | null,
  snapshot: VerifiedPaymentSnapshot,
): FinalizationDecision {
  if (!state) {
    return { kind: 'RETURN', result: { ok: false, reason: 'NOT_FOUND' } };
  }
  if (
    state.reference !== snapshot.reference ||
    state.totalCents !== snapshot.amountCents ||
    state.currency !== snapshot.currency ||
    (state.providerTransactionId !== null &&
      state.providerTransactionId !== snapshot.providerTransactionId)
  ) {
    return { kind: 'RETURN', result: { ok: false, reason: 'MISMATCH' } };
  }
  if (!state.submissionStarted) {
    return { kind: 'RETURN', result: { ok: false, reason: 'NOT_SUBMITTED' } };
  }

  const transition = paymentTransition(state.paymentStatus, snapshot.status);
  if (transition === 'CONFLICT') {
    return {
      kind: 'RETURN',
      result: { ok: false, reason: 'TERMINAL_CONFLICT' },
    };
  }
  if (transition === 'REPLAY' || transition === 'STALE') {
    if (!isFinalPaymentStatus(state.paymentStatus)) {
      throw new Error('Terminal payment state invariant violated');
    }
    return {
      kind: 'RETURN',
      result: {
        ok: true,
        value: {
          reference: state.reference,
          paymentStatus: state.paymentStatus,
          fulfillmentStatus: state.fulfillmentStatus,
          applied: false,
        },
      },
    };
  }
  return { kind: 'APPLY', needsStock: snapshot.status === 'APPROVED' };
}

export function fulfillmentAfterFinalization(
  current: FulfillmentStatus,
  needsStock: boolean,
  stockReserved: boolean,
): FulfillmentStatus {
  if (!needsStock) return current;
  return stockReserved ? 'CREATED' : 'STOCK_UNAVAILABLE';
}
