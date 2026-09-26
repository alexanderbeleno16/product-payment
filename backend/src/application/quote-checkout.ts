import type { CheckoutQuote, CheckoutResult } from './checkout';
import { priceCheckout } from './checkout-pricing';
import type { ProductReader } from './product-reader.port';

export class QuoteCheckout {
  constructor(private readonly products: ProductReader) {}

  async execute(
    productId: string,
    quantity: number,
  ): Promise<CheckoutResult<CheckoutQuote>> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return { ok: false, reason: 'INVALID_INPUT' };
    }
    const product = await this.products.findById(productId);
    if (!product) return { ok: false, reason: 'PRODUCT_NOT_FOUND' };
    return priceCheckout(product, quantity);
  }
}
