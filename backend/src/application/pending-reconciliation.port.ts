export interface PendingReconciliationClaim {
  readonly reference: string;
  readonly leaseOwner: string;
  readonly attempt: number;
}

export interface PendingReconciliationQueue {
  claim(
    batchSize: number,
    minAgeSeconds: number,
    leaseSeconds: number,
  ): Promise<readonly PendingReconciliationClaim[]>;
  release(
    claim: PendingReconciliationClaim,
    retrySeconds: number,
  ): Promise<void>;
}
