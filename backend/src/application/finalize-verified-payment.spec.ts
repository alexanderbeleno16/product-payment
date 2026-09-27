import { FinalizeVerifiedPayment } from './finalize-verified-payment';
import type {
  FinalizationStore,
  VerifiedPaymentSnapshot,
} from './finalize-verified-payment';
import { paymentTransition } from '../domain/checkout';

const approved: VerifiedPaymentSnapshot = {
  providerTransactionId: 'sandbox-payment-1',
  reference: 'txn_123',
  amountCents: 20_700_000,
  currency: 'COP',
  status: 'APPROVED',
};

describe('FinalizeVerifiedPayment', () => {
  it('passes only the verified snapshot to the atomic persistence capability', async () => {
    const finalize = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        reference: approved.reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
      },
    });
    const useCase = new FinalizeVerifiedPayment({
      finalize,
    } as FinalizationStore);
    await expect(useCase.execute(approved)).resolves.toMatchObject({
      ok: true,
      value: { paymentStatus: 'APPROVED', fulfillmentStatus: 'CREATED' },
    });
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith(approved);
  });

  it('preserves an expected binding failure rather than inventing success', async () => {
    const finalize = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: 'MISMATCH' });
    const useCase = new FinalizeVerifiedPayment({
      finalize,
    } as FinalizationStore);
    await expect(useCase.execute(approved)).resolves.toEqual({
      ok: false,
      reason: 'MISMATCH',
    });
  });
});

describe('paymentTransition', () => {
  it('applies confirmed outcomes to nonterminal local states', () => {
    expect(paymentTransition('PENDING', 'APPROVED')).toBe('APPLY');
    expect(paymentTransition('SUBMISSION_UNKNOWN', 'DECLINED')).toBe('APPLY');
    expect(paymentTransition('SUBMISSION_REJECTED', 'APPROVED')).toBe('APPLY');
  });

  it('does not regress a terminal result to pending or another terminal result', () => {
    expect(paymentTransition('APPROVED', 'PENDING')).toBe('STALE');
    expect(paymentTransition('APPROVED', 'APPROVED')).toBe('REPLAY');
    expect(paymentTransition('APPROVED', 'DECLINED')).toBe('CONFLICT');
    expect(paymentTransition('VOIDED', 'ERROR')).toBe('CONFLICT');
  });
});
