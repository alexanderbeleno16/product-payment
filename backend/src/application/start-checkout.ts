import { createHash, randomUUID } from 'node:crypto';
import type {
  CheckoutInput,
  CheckoutResult,
  CheckoutTransaction,
} from './checkout';
import { priceCheckout } from '../domain/checkout-pricing';
import { IdempotencyKeyTaken, type CheckoutStore } from './checkout-store.port';
import type { ProductReader } from './product-reader.port';
import { isUuidV4 } from './uuid-v4';

function normalize(input: CheckoutInput): CheckoutInput {
  return {
    idempotencyKey: input.idempotencyKey.trim().toLowerCase(),
    productId: input.productId.trim().toLowerCase(),
    quantity: input.quantity,
    installments: input.installments,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    delivery: {
      recipientName: input.delivery.recipientName.trim(),
      addressLine: input.delivery.addressLine.trim(),
      city: input.delivery.city.trim(),
    },
  };
}

function isValid(input: CheckoutInput): boolean {
  return (
    isUuidV4(input.idempotencyKey) &&
    isUuidV4(input.productId) &&
    Number.isSafeInteger(input.quantity) &&
    input.quantity > 0 &&
    Number.isSafeInteger(input.installments) &&
    input.installments > 0 &&
    input.customerEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail) &&
    input.delivery.recipientName.length > 0 &&
    input.delivery.recipientName.length <= 120 &&
    input.delivery.addressLine.length > 0 &&
    input.delivery.addressLine.length <= 240 &&
    input.delivery.city.length > 0 &&
    input.delivery.city.length <= 120
  );
}

export class StartCheckout {
  constructor(
    private readonly products: ProductReader,
    private readonly store: CheckoutStore,
  ) {}

  async execute(
    raw: CheckoutInput,
  ): Promise<CheckoutResult<CheckoutTransaction>> {
    const input = normalize(raw);
    if (!isValid(input)) return { ok: false, reason: 'INVALID_INPUT' };

    // The fingerprint intentionally omits transient payment credentials, current price,
    // and the key itself. A replay returns the original amount even if price changes.
    const fingerprintFields: (string | number)[] = [
      input.productId,
      input.quantity,
      input.customerEmail,
      input.delivery.recipientName,
      input.delivery.addressLine,
      input.delivery.city,
    ];
    // Preserve the existing fingerprint for one installment so older checkouts replay safely.
    if (input.installments !== 1) fingerprintFields.push(input.installments);
    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(fingerprintFields))
      .digest('hex');
    const existing = await this.store.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) return this.replay(existing, requestFingerprint);

    const product = await this.products.findById(input.productId);
    if (!product) return { ok: false, reason: 'PRODUCT_NOT_FOUND' };
    const quote = priceCheckout(product, input.quantity);
    if (!quote.ok) return quote;

    try {
      const checkout = await this.store.createPending({
        id: randomUUID(),
        reference: `txn_${randomUUID()}`,
        input,
        quote: quote.value,
        requestFingerprint,
      });
      return { ok: true, value: checkout };
    } catch (error) {
      // A concurrent first request may have won the unique-key race. Let the
      // persistence adapter signal only this specific constraint violation.
      if (!(error instanceof IdempotencyKeyTaken)) throw error;
      const winner = await this.store.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (!winner) throw error;
      return this.replay(winner, requestFingerprint);
    }
  }

  private replay(
    existing: CheckoutTransaction,
    fingerprint: string,
  ): CheckoutResult<CheckoutTransaction> {
    return existing.requestFingerprint === fingerprint
      ? { ok: true, value: existing }
      : { ok: false, reason: 'IDEMPOTENCY_CONFLICT' };
  }
}
