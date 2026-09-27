import type { VerifiedPaymentSnapshot } from './finalize-verified-payment';

/** Server-side authoritative transaction lookup; null means unavailable or invalid. */
export interface PaymentStatusReader {
  getById(
    providerTransactionId: string,
  ): Promise<VerifiedPaymentSnapshot | null>;
}
