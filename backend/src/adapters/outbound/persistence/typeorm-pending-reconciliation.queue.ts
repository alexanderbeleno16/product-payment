import { randomUUID } from 'node:crypto';
import type {
  PendingReconciliationClaim,
  PendingReconciliationQueue,
} from '../../../application/pending-reconciliation.port';
import { DatabaseConnection } from './database-connection';

/** Atomic, short-lived database claim; no transaction spans the provider GET. */
export class TypeOrmPendingReconciliationQueue implements PendingReconciliationQueue {
  constructor(private readonly connection: DatabaseConnection) {}

  async claim(
    batchSize: number,
    minAgeSeconds: number,
    leaseSeconds: number,
  ): Promise<readonly PendingReconciliationClaim[]> {
    const owner = randomUUID();
    const source = await this.connection.get();
    const [rows] = (await source.query(
      `
      WITH due AS (
        SELECT id FROM transactions
        WHERE status = 'PENDING'
          AND provider_transaction_id IS NOT NULL
          AND submission_started_at IS NOT NULL
          AND submission_started_at <= now() - ($2 * interval '1 second')
          AND reconciliation_next_at <= now()
          AND (reconciliation_lease_until IS NULL OR reconciliation_lease_until <= now())
        ORDER BY reconciliation_next_at, created_at
        LIMIT $1 FOR UPDATE SKIP LOCKED
      )
      UPDATE transactions AS t
      SET reconciliation_lease_owner = $4::uuid,
          reconciliation_lease_until = now() + ($3 * interval '1 second'),
          reconciliation_attempts = t.reconciliation_attempts + 1
      FROM due WHERE t.id = due.id
      RETURNING t.reference, t.reconciliation_attempts
    `,
      [batchSize, minAgeSeconds, leaseSeconds, owner],
    )) as [{ reference: string; reconciliation_attempts: number }[], number];
    return rows.map((row) => ({
      reference: row.reference,
      leaseOwner: owner,
      attempt: row.reconciliation_attempts,
    }));
  }

  async release(
    claim: PendingReconciliationClaim,
    retrySeconds: number,
  ): Promise<void> {
    const source = await this.connection.get();
    await source.query(
      `
      UPDATE transactions
      SET reconciliation_lease_owner = NULL,
          reconciliation_lease_until = NULL,
          reconciliation_next_at = now() + ($3 * interval '1 second')
      WHERE reference = $1 AND reconciliation_lease_owner = $2::uuid
    `,
      [claim.reference, claim.leaseOwner, retrySeconds],
    );
  }
}
