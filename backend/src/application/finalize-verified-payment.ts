import type { FinalPaymentStatus, FulfillmentStatus } from '../domain/checkout';

/** Authoritative provider transaction facts, obtained after inbound verification. */
export interface VerifiedPaymentSnapshot {
  readonly providerTransactionId: string;
  readonly reference: string;
  readonly amountCents: number;
  readonly currency: 'COP';
  readonly status: FinalPaymentStatus | 'PENDING';
}

export type FinalizationResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly reference: string;
        readonly paymentStatus: FinalPaymentStatus | 'PENDING';
        readonly fulfillmentStatus: FulfillmentStatus;
        readonly applied: boolean;
      };
    }
  | {
      readonly ok: false;
      readonly reason:
        'NOT_FOUND' | 'MISMATCH' | 'TERMINAL_CONFLICT' | 'NOT_SUBMITTED';
    };

/** One atomic local capability: payment transition, stock and delivery share a DB transaction. */
export interface FinalizationStore {
  finalize(snapshot: VerifiedPaymentSnapshot): Promise<FinalizationResult>;
}

export class FinalizeVerifiedPayment {
  constructor(private readonly store: FinalizationStore) {}

  execute(snapshot: VerifiedPaymentSnapshot): Promise<FinalizationResult> {
    return this.store.finalize(snapshot);
  }
}
