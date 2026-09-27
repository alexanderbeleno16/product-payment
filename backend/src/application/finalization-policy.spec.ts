import type { VerifiedPaymentSnapshot } from './finalize-verified-payment';
import {
  decideFinalization,
  fulfillmentAfterFinalization,
  type FinalizationState,
} from './finalization-policy';

const snapshot: VerifiedPaymentSnapshot = {
  providerTransactionId: 'provider-1',
  reference: 'reference-1',
  amountCents: 25_000,
  currency: 'COP',
  status: 'APPROVED',
};

const pending: FinalizationState = {
  reference: snapshot.reference,
  totalCents: snapshot.amountCents,
  currency: 'COP',
  providerTransactionId: null,
  submissionStarted: true,
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'NOT_STARTED',
};

describe('finalization policy', () => {
  it('rejects missing, unclaimed, and mismatched local transactions before effects', () => {
    expect(decideFinalization(null, snapshot)).toEqual({
      kind: 'RETURN',
      result: { ok: false, reason: 'NOT_FOUND' },
    });
    for (const state of [
      { ...pending, reference: 'other' },
      { ...pending, totalCents: pending.totalCents + 1 },
      { ...pending, currency: 'USD' as 'COP' },
      { ...pending, providerTransactionId: 'other-provider' },
    ]) {
      expect(decideFinalization(state, snapshot)).toEqual({
        kind: 'RETURN',
        result: { ok: false, reason: 'MISMATCH' },
      });
    }
    expect(
      decideFinalization({ ...pending, submissionStarted: false }, snapshot),
    ).toEqual({
      kind: 'RETURN',
      result: { ok: false, reason: 'NOT_SUBMITTED' },
    });
  });

  it('applies approval with stock fulfillment but does not request stock for pending or failure', () => {
    expect(decideFinalization(pending, snapshot)).toEqual({
      kind: 'APPLY',
      needsStock: true,
    });
    for (const status of ['PENDING', 'DECLINED', 'VOIDED', 'ERROR'] as const) {
      expect(decideFinalization(pending, { ...snapshot, status })).toEqual({
        kind: 'APPLY',
        needsStock: false,
      });
    }
  });

  it('preserves terminal result on replay or stale pending and rejects conflicting finals', () => {
    const approved: FinalizationState = {
      ...pending,
      providerTransactionId: snapshot.providerTransactionId,
      paymentStatus: 'APPROVED',
      fulfillmentStatus: 'STOCK_UNAVAILABLE',
    };
    for (const status of ['APPROVED', 'PENDING'] as const) {
      expect(decideFinalization(approved, { ...snapshot, status })).toEqual({
        kind: 'RETURN',
        result: {
          ok: true,
          value: {
            reference: snapshot.reference,
            paymentStatus: 'APPROVED',
            fulfillmentStatus: 'STOCK_UNAVAILABLE',
            applied: false,
          },
        },
      });
    }
    expect(
      decideFinalization(approved, { ...snapshot, status: 'DECLINED' }),
    ).toEqual({
      kind: 'RETURN',
      result: { ok: false, reason: 'TERMINAL_CONFLICT' },
    });
    expect(
      decideFinalization({ ...approved, paymentStatus: 'DECLINED' }, snapshot),
    ).toEqual({
      kind: 'RETURN',
      result: { ok: false, reason: 'TERMINAL_CONFLICT' },
    });
  });

  it('reports paid-but-unfulfilled stock exhaustion without treating payment as failed', () => {
    expect(fulfillmentAfterFinalization('NOT_STARTED', true, true)).toBe(
      'CREATED',
    );
    expect(fulfillmentAfterFinalization('NOT_STARTED', true, false)).toBe(
      'STOCK_UNAVAILABLE',
    );
    expect(fulfillmentAfterFinalization('NOT_STARTED', false, false)).toBe(
      'NOT_STARTED',
    );
  });
});
