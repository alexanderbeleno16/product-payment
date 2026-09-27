import type { CheckoutQuote, CheckoutResult } from './checkout';
import type { Product } from './product';

// Demo policy: COP 2,000 base fee and COP 5,000 delivery fee, expressed in cents.
export const BASE_FEE_CENTS = 200_000;
export const DELIVERY_FEE_CENTS = 500_000;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function priceCheckout(
  product: Product,
  quantity: number,
): CheckoutResult<CheckoutQuote> {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  if (product.currency !== 'COP') {
    return { ok: false, reason: 'UNSUPPORTED_CURRENCY' };
  }
  if (product.stock < quantity) {
    return { ok: false, reason: 'INSUFFICIENT_STOCK' };
  }
  const productAmountCents = product.priceCents * quantity;
  const totalCents = productAmountCents + BASE_FEE_CENTS + DELIVERY_FEE_CENTS;
  if (
    !Number.isSafeInteger(totalCents) ||
    productAmountCents <= 0 ||
    totalCents > POSTGRES_INTEGER_MAX
  ) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  return {
    ok: true,
    value: {
      productId: product.id,
      quantity,
      currency: 'COP',
      unitPriceCents: product.priceCents,
      productAmountCents,
      baseFeeCents: BASE_FEE_CENTS,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents,
    },
  };
}
