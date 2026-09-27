import type { CheckoutTransaction } from './checkout';
import type { CheckoutStore } from './checkout-store.port';
import { GetTransactionStatus } from './get-transaction-status';

const idempotencyKey = 'cf2cdd86-05ea-4c7c-adeb-812927f37873';
const reference = 'txn_8a52ea31-08d9-4f52-a604-00e56143dce0';
const transaction: CheckoutTransaction = {
  id: '85a03ed7-535e-43c5-aa41-efbe9c659f4a',
  reference,
  customerId: '98439e91-4a7c-40f5-b43b-73f68e6c282e',
  idempotencyKey,
  requestFingerprint: 'sensitive-internal-fingerprint',
  productId: '20dcb456-952d-4655-9af4-102656e90f3e',
  quantity: 1,
  currency: 'COP',
  unitPriceCents: 100_000,
  productAmountCents: 100_000,
  baseFeeCents: 10_000,
  deliveryFeeCents: 5_000,
  totalCents: 115_000,
  status: 'SUBMISSION_UNKNOWN',
  fulfillmentStatus: 'NOT_STARTED',
  submissionStartedAt: new Date('2026-09-26T12:00:00Z'),
  providerTransactionId: 'private-provider-identifier',
  createdAt: new Date('2026-09-26T11:59:00Z'),
};

describe('GetTransactionStatus', () => {
  const findByIdempotencyKey = jest.fn();
  const createPending = jest.fn();
  const claimSubmission = jest.fn();
  const recordSubmissionOutcome = jest.fn();
  const store: CheckoutStore = {
    findByIdempotencyKey,
    findByReference: jest.fn(),
    createPending,
    claimSubmission,
    recordSubmissionOutcome,
  };
  const useCase = new GetTransactionStatus(store);

  beforeEach(() => {
    jest.clearAllMocks();
    findByIdempotencyKey.mockResolvedValue(transaction);
  });

  it('returns only payment and fulfillment state for the matching key and reference', async () => {
    await expect(useCase.execute(reference, idempotencyKey)).resolves.toEqual({
      ok: true,
      value: {
        reference,
        paymentStatus: 'SUBMISSION_UNKNOWN',
        fulfillmentStatus: 'NOT_STARTED',
      },
    });
    expect(findByIdempotencyKey).toHaveBeenCalledWith(idempotencyKey);
    expect(createPending).not.toHaveBeenCalled();
    expect(claimSubmission).not.toHaveBeenCalled();
    expect(recordSubmissionOutcome).not.toHaveBeenCalled();
  });

  it('uses the same not-found result for a wrong key and a wrong reference', async () => {
    findByIdempotencyKey.mockResolvedValueOnce(null);
    await expect(useCase.execute(reference, 'wrong-key')).resolves.toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
    await expect(
      useCase.execute('txn_different-reference', idempotencyKey),
    ).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('canonicalizes the key consistently with checkout creation', async () => {
    await useCase.execute(reference, ` ${idempotencyKey.toUpperCase()} `);
    expect(findByIdempotencyKey).toHaveBeenCalledWith(idempotencyKey);
  });
});
