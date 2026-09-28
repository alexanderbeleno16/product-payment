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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalizeCheckoutInput(raw: unknown): CheckoutInput | null {
  if (!isRecord(raw) || !isRecord(raw.delivery)) return null;
  if (
    typeof raw.idempotencyKey !== 'string' ||
    typeof raw.productId !== 'string' ||
    typeof raw.customerEmail !== 'string' ||
    typeof raw.delivery.recipientName !== 'string' ||
    typeof raw.delivery.addressLine !== 'string' ||
    typeof raw.delivery.city !== 'string' ||
    typeof raw.quantity !== 'number' ||
    typeof raw.expectedTotalCents !== 'number' ||
    typeof raw.installments !== 'number' ||
    !Number.isSafeInteger(raw.quantity) ||
    !Number.isSafeInteger(raw.expectedTotalCents) ||
    !Number.isSafeInteger(raw.installments)
  )
    return null;

  const input: CheckoutInput = {
    idempotencyKey: raw.idempotencyKey.trim().toLowerCase(),
    productId: raw.productId.trim().toLowerCase(),
    quantity: raw.quantity,
    expectedTotalCents: raw.expectedTotalCents,
    installments: raw.installments,
    customerEmail: raw.customerEmail.trim().toLowerCase(),
    delivery: {
      recipientName: raw.delivery.recipientName.trim(),
      addressLine: raw.delivery.addressLine.trim(),
      city: raw.delivery.city.trim(),
    },
  };
  if (
    !isUuidV4(input.idempotencyKey) ||
    !isUuidV4(input.productId) ||
    input.quantity < 1 ||
    input.expectedTotalCents < 1 ||
    input.installments < 1 ||
    input.customerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail) ||
    input.delivery.recipientName.length < 1 ||
    input.delivery.recipientName.length > 120 ||
    input.delivery.addressLine.length < 1 ||
    input.delivery.addressLine.length > 240 ||
    input.delivery.city.length < 1 ||
    input.delivery.city.length > 120
  )
    return null;
  return input;
}

export class StartCheckout {
  constructor(
    private readonly products: ProductReader,
    private readonly store: CheckoutStore,
  ) {}

  async execute(
    raw: CheckoutInput,
  ): Promise<CheckoutResult<CheckoutTransaction>> {
    const input = canonicalizeCheckoutInput(raw);
    if (!input) return { ok: false, reason: 'INVALID_INPUT' };

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
    if (existing)
      return this.replay(
        existing,
        requestFingerprint,
        input.expectedTotalCents,
      );

    const product = await this.products.findById(input.productId);
    if (!product) return { ok: false, reason: 'PRODUCT_NOT_FOUND' };
    const quote = priceCheckout(product, input.quantity);
    if (!quote.ok) return quote;
    if (quote.value.totalCents !== input.expectedTotalCents) {
      return { ok: false, reason: 'QUOTE_CHANGED' };
    }

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
      return this.replay(winner, requestFingerprint, input.expectedTotalCents);
    }
  }

  private replay(
    existing: CheckoutTransaction,
    fingerprint: string,
    expectedTotalCents: number,
  ): CheckoutResult<CheckoutTransaction> {
    return existing.requestFingerprint === fingerprint &&
      existing.totalCents === expectedTotalCents
      ? { ok: true, value: existing }
      : { ok: false, reason: 'IDEMPOTENCY_CONFLICT' };
  }
}
