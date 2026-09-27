import { FinalizeVerifiedPayment } from './finalize-verified-payment';
import type {
  FinalizationStore,
  VerifiedPaymentSnapshot,
} from './finalize-verified-payment';
import type { PaymentStatusReader } from './payment-status-reader.port';
import { ReceivePaymentEvent } from './receive-payment-event';

const authoritative: VerifiedPaymentSnapshot = {
  providerTransactionId: 'provider-transaction-1',
  reference: 'txn_test-reference',
  amountCents: 2_700_000,
  currency: 'COP',
  status: 'APPROVED',
};

describe('ReceivePaymentEvent', () => {
  const getById = jest.fn();
  const finalize = jest.fn();
  const useCase = new ReceivePaymentEvent(
    { getById } as PaymentStatusReader,
    new FinalizeVerifiedPayment({ finalize } as FinalizationStore),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getById.mockResolvedValue(authoritative);
    finalize.mockResolvedValue({
      ok: true,
      value: {
        reference: authoritative.reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
      },
    });
  });

  it('looks up the signed ID and finalizes only the authoritative snapshot', async () => {
    await expect(
      useCase.execute(authoritative.providerTransactionId),
    ).resolves.toMatchObject({ ok: true });
    expect(getById).toHaveBeenCalledWith(authoritative.providerTransactionId);
    expect(finalize).toHaveBeenCalledWith(authoritative);
  });

  it('stops before finalization when lookup is unavailable or returns another ID', async () => {
    getById.mockResolvedValueOnce(null);
    await expect(
      useCase.execute(authoritative.providerTransactionId),
    ).resolves.toEqual({ ok: false, reason: 'STATUS_UNAVAILABLE' });
    getById.mockResolvedValueOnce({
      ...authoritative,
      providerTransactionId: 'other',
    });
    await expect(
      useCase.execute(authoritative.providerTransactionId),
    ).resolves.toEqual({ ok: false, reason: 'MISMATCH' });
    expect(finalize).not.toHaveBeenCalled();
  });
});
