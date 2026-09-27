import { FinalizeVerifiedPayment } from './finalize-verified-payment';
import type { FinalizationResult } from './finalize-verified-payment';
import type { PaymentStatusReader } from './payment-status-reader.port';

export type ReceivePaymentEventResult =
  | FinalizationResult
  | { readonly ok: false; readonly reason: 'STATUS_UNAVAILABLE' };

export class ReceivePaymentEvent {
  constructor(
    private readonly statusReader: PaymentStatusReader,
    private readonly finalize: FinalizeVerifiedPayment,
  ) {}

  async execute(
    providerTransactionId: string,
  ): Promise<ReceivePaymentEventResult> {
    const authoritative = await this.statusReader.getById(
      providerTransactionId,
    );
    if (!authoritative) return { ok: false, reason: 'STATUS_UNAVAILABLE' };
    if (authoritative.providerTransactionId !== providerTransactionId) {
      return { ok: false, reason: 'MISMATCH' };
    }
    return this.finalize.execute(authoritative);
  }
}
