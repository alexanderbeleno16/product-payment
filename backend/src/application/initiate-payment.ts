import type { CheckoutInput, CheckoutResult, CheckoutTransaction } from './checkout';
import type { CheckoutStore } from './checkout-store.port';
import type { PaymentCredentials, PaymentGateway } from './payment-gateway.port';
import { StartCheckout } from './start-checkout';

export class InitiatePayment {
  constructor(
    private readonly startCheckout: StartCheckout,
    private readonly store: CheckoutStore,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async execute(
    input: CheckoutInput,
    credentials: PaymentCredentials,
  ): Promise<CheckoutResult<CheckoutTransaction>> {
    // A missing transient credential must not leave an unusable PENDING row.
    if (
      !credentials.cardToken?.trim() ||
      !credentials.acceptanceToken?.trim() ||
      !credentials.personalDataToken?.trim()
    ) {
      return { ok: false, reason: 'INVALID_INPUT' };
    }

    const checkout = await this.startCheckout.execute(input);
    if (!checkout.ok) return checkout;

    // The database claim is committed before I/O. A replay, a concurrent request,
    // or a process restart cannot send another charge for this reference.
    if (!(await this.store.claimSubmission(checkout.value.reference))) {
      const current = await this.store.findByIdempotencyKey(
        checkout.value.idempotencyKey,
      );
      if (!current) throw new Error('Claimed checkout disappeared');
      return { ok: true, value: current };
    }

    let outcome;
    try {
      outcome = await this.paymentGateway.submit({
        ...credentials,
        reference: checkout.value.reference,
        amountCents: checkout.value.totalCents,
        currency: checkout.value.currency,
        customerEmail: input.customerEmail.trim().toLowerCase(),
      });
    } catch {
      // Once claimed, even an unexpected adapter fault may follow a sent request.
      outcome = { kind: 'UNKNOWN' } as const;
    }
    const updated = await this.store.recordSubmissionOutcome(
      checkout.value.reference,
      outcome,
    );
    return { ok: true, value: updated };
  }
}
