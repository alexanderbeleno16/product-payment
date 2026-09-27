import type { CheckoutInput, CheckoutTransaction } from './checkout';
import type { CheckoutQuote } from '../domain/checkout';

export interface NewPendingCheckout {
  readonly id: string;
  readonly reference: string;
  readonly input: CheckoutInput;
  readonly quote: CheckoutQuote;
  readonly requestFingerprint: string;
}

export interface CheckoutStore {
  findByIdempotencyKey(key: string): Promise<CheckoutTransaction | null>;
  createPending(command: NewPendingCheckout): Promise<CheckoutTransaction>;
  /** One durable claim per transaction; false means another request already claimed it. */
  claimSubmission(reference: string): Promise<boolean>;
}

/** Persistence adapter raises this only for a duplicate idempotency key. */
export class IdempotencyKeyTaken extends Error {}
