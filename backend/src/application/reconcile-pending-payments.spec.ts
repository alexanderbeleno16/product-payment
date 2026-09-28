import type { PendingReconciliationQueue } from './pending-reconciliation.port';
import { ReconcileKnownPayment } from './reconcile-known-payment';
import { ReconcilePendingPayments } from './reconcile-pending-payments';

describe('ReconcilePendingPayments', () => {
  const claim = jest.fn();
  const release = jest.fn();
  const execute = jest.fn();
  const queue = { claim, release } as unknown as PendingReconciliationQueue;
  const reconcile = { execute } as unknown as ReconcileKnownPayment;
  const useCase = new ReconcilePendingPayments(queue, reconcile);

  beforeEach(() => {
    jest.resetAllMocks();
    release.mockResolvedValue(undefined);
  });

  it('requests a bounded batch and releases successful and failed leases', async () => {
    const first = { reference: 'txn_one', leaseOwner: 'owner', attempt: 1 };
    const second = { reference: 'txn_two', leaseOwner: 'owner', attempt: 2 };
    claim
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second])
      .mockResolvedValue([]);
    execute
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(useCase.run(5, 30, 120)).resolves.toEqual({
      checked: 2,
      failures: 1,
    });
    expect(claim).toHaveBeenCalledTimes(3);
    expect(claim).toHaveBeenCalledWith(1, 30, 120);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenNthCalledWith(1, first, 15);
    expect(release).toHaveBeenNthCalledWith(2, second, 30);
  });

  it('caps retry delay and never submits a new payment', async () => {
    const item = { reference: 'txn_one', leaseOwner: 'owner', attempt: 12 };
    claim.mockResolvedValue([item]);
    execute.mockResolvedValue({ ok: false, reason: 'STATUS_UNAVAILABLE' });
    await useCase.run(1, 30, 120);
    expect(release).toHaveBeenCalledWith(item, 300);
  });

  it('does not lease the next payment while a slow provider lookup is running', async () => {
    const first = { reference: 'txn_one', leaseOwner: 'owner', attempt: 1 };
    const second = { reference: 'txn_two', leaseOwner: 'owner', attempt: 1 };
    claim.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);
    let finishLookup!: (result: { ok: true }) => void;
    execute.mockImplementationOnce(
      () => new Promise((resolve) => { finishLookup = resolve; }),
    ).mockResolvedValueOnce({ ok: true });

    const running = useCase.run(2, 30, 90);
    await Promise.resolve();
    await Promise.resolve();
    expect(claim).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    finishLookup({ ok: true });
    await expect(running).resolves.toEqual({ checked: 2, failures: 0 });
    expect(claim).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenNthCalledWith(1, first, 15);
    expect(release).toHaveBeenNthCalledWith(2, second, 15);
  });
});
