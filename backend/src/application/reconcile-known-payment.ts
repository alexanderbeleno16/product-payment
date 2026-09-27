import type { CheckoutStore } from './checkout-store.port';
import { ReceivePaymentEvent } from './receive-payment-event';
import type { ReceivePaymentEventResult } from './receive-payment-event';

export type ReconciliationResult =
  | ReceivePaymentEventResult
  | { readonly ok: false; readonly reason: 'NOT_FOUND' | 'ID_UNAVAILABLE' };

/** Explicit operator-only recovery for a checkout already bound to a provider ID. */
export class ReconcileKnownPayment {
  constructor(
    private readonly checkouts: Pick<CheckoutStore, 'findByReference'>,
    private readonly receivePaymentEvent: ReceivePaymentEvent,
  ) {}

  async execute(reference: string): Promise<ReconciliationResult> {
    const checkout = await this.checkouts.findByReference(reference);
    if (!checkout || checkout.reference !== reference) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (!checkout.providerTransactionId || !checkout.submissionStartedAt) {
      return { ok: false, reason: 'ID_UNAVAILABLE' };
    }
    return this.receivePaymentEvent.execute(checkout.providerTransactionId);
  }
}
