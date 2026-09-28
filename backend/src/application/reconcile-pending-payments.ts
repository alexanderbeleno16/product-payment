import type { PendingReconciliationQueue } from './pending-reconciliation.port';
import { ReconcileKnownPayment } from './reconcile-known-payment';

/** Bounded fallback for a lost signed event. Never initiates a payment. */
export class ReconcilePendingPayments {
  constructor(
    private readonly queue: PendingReconciliationQueue,
    private readonly reconcile: ReconcileKnownPayment,
  ) {}

  async run(
    batchSize: number,
    minAgeSeconds: number,
    leaseSeconds: number,
  ): Promise<{ checked: number; failures: number }> {
    const claims = await this.queue.claim(
      batchSize,
      minAgeSeconds,
      leaseSeconds,
    );
    let failures = 0;
    for (const claim of claims) {
      try {
        const result = await this.reconcile.execute(claim.reference);
        if (!result.ok) failures += 1;
      } catch {
        failures += 1;
      } finally {
        const retrySeconds = Math.min(
          300,
          15 * 2 ** Math.min(claim.attempt - 1, 5),
        );
        await this.queue.release(claim, retrySeconds);
      }
    }
    return { checked: claims.length, failures };
  }
}
