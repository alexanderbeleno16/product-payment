import type { CheckoutQuote } from '../domain/checkout';
import type { CheckoutResult } from './checkout';
import { priceCheckout } from '../domain/checkout-pricing';
import type { ProductReader } from './product-reader.port';
import { isUuidV4 } from './uuid-v4';

export class QuoteCheckout {
  constructor(private readonly products: ProductReader) {}

  async execute(
    productId: string,
    quantity: number,
  ): Promise<CheckoutResult<CheckoutQuote>> {
    if (
      !isUuidV4(productId) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return { ok: false, reason: 'INVALID_INPUT' };
    }
    const product = await this.products.findById(productId);
    if (!product) return { ok: false, reason: 'PRODUCT_NOT_FOUND' };
    return priceCheckout(product, quantity);
  }
}
