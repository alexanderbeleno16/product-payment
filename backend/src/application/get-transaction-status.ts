import type { CheckoutTransaction } from './checkout';
import type { CheckoutStore } from './checkout-store.port';

export type TransactionStatusView = Pick<
  CheckoutTransaction,
  'reference' | 'status'
>;

export type TransactionStatusResult =
  | { readonly ok: true; readonly value: TransactionStatusView }
  | { readonly ok: false; readonly reason: 'NOT_FOUND' };

export class GetTransactionStatus {
  constructor(private readonly store: CheckoutStore) {}

  async execute(
    reference: string,
    idempotencyKey: string,
  ): Promise<TransactionStatusResult> {
    const transaction = await this.store.findByIdempotencyKey(
      idempotencyKey.trim().toLowerCase(),
    );

    if (!transaction || transaction.reference !== reference) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    return {
      ok: true,
      value: {
        reference: transaction.reference,
        status: transaction.status,
      },
    };
  }
}
