import type { CheckoutTransaction } from './checkout';
import type { CheckoutStore } from './checkout-store.port';
import { ReconcileKnownPayment } from './reconcile-known-payment';
import { ReceivePaymentEvent } from './receive-payment-event';

const reference = 'txn_8a52ea31-08d9-4f52-a604-00e56143dce0';
const checkout = {
  reference,
  providerTransactionId: 'provider-transaction-1',
  submissionStartedAt: new Date('2026-09-26T00:00:00Z'),
} as CheckoutTransaction;

describe('ReconcileKnownPayment', () => {
  const findByReference = jest.fn();
  const execute = jest.fn();
  const useCase = new ReconcileKnownPayment(
    { findByReference } as Pick<CheckoutStore, 'findByReference'>,
    { execute } as unknown as ReceivePaymentEvent,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findByReference.mockResolvedValue(checkout);
    execute.mockResolvedValue({
      ok: true,
      value: {
        reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
      },
    });
  });

  it('scopes recovery to one stored reference and its bound provider ID', async () => {
    await expect(useCase.execute(reference)).resolves.toMatchObject({
      ok: true,
    });
    expect(findByReference).toHaveBeenCalledWith(reference);
    expect(execute).toHaveBeenCalledWith('provider-transaction-1');
  });

  it('does not fetch for a missing or mismatched checkout', async () => {
    findByReference.mockResolvedValueOnce(null);
    await expect(useCase.execute(reference)).resolves.toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
    findByReference.mockResolvedValueOnce({
      ...checkout,
      reference: 'txn_other',
    });
    await expect(useCase.execute(reference)).resolves.toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a checkout without a durably claimed and bound provider ID', async () => {
    findByReference.mockResolvedValueOnce({
      ...checkout,
      providerTransactionId: null,
    });
    await expect(useCase.execute(reference)).resolves.toEqual({
      ok: false,
      reason: 'ID_UNAVAILABLE',
    });
    findByReference.mockResolvedValueOnce({
      ...checkout,
      submissionStartedAt: null,
    });
    await expect(useCase.execute(reference)).resolves.toEqual({
      ok: false,
      reason: 'ID_UNAVAILABLE',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('propagates provider outage and idempotent replay from the guarded path', async () => {
    execute.mockResolvedValueOnce({ ok: false, reason: 'STATUS_UNAVAILABLE' });
    await expect(useCase.execute(reference)).resolves.toEqual({
      ok: false,
      reason: 'STATUS_UNAVAILABLE',
    });
    execute.mockResolvedValueOnce({
      ok: true,
      value: {
        reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: false,
      },
    });
    await expect(useCase.execute(reference)).resolves.toMatchObject({
      ok: true,
      value: { applied: false },
    });
  });
});
