import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import {
  cardEntryRequested,
  loadProduct,
  loadQuote,
  quantityChanged,
} from './checkoutSlice'

function ProductScreen() {
  const dispatch = useAppDispatch()
  const {
    productId,
    quantity,
    product,
    productStatus,
    productError,
    quote,
    quoteStatus,
    quoteError,
  } = useAppSelector((state) => state.checkout)

  useEffect(() => {
    const request = dispatch(loadProduct(productId))
    return () => request.abort()
  }, [dispatch, productId])

  useEffect(() => {
    if (productStatus !== 'ready' || !product || product.stock < quantity)
      return
    const request = dispatch(loadQuote({ productId, quantity }))
    return () => request.abort()
  }, [dispatch, productId, productStatus, product, quantity])

  if (productStatus === 'idle' || productStatus === 'loading') {
    return (
      <>
        <CheckoutHeader step={1} />
        <main className="checkout-main">
          <div className="state-panel" role="status">
            Loading product…
          </div>
        </main>
      </>
    )
  }

  if (productStatus === 'error' || !product) {
    return (
      <>
        <CheckoutHeader step={1} />
        <main className="checkout-main">
          <div className="state-panel" role="alert">
            <h1>Product unavailable</h1>
            <p>{productError ?? 'This product could not be loaded.'}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void dispatch(loadProduct(productId))}
            >
              Try again
            </button>
          </div>
        </main>
      </>
    )
  }

  const soldOut = product.stock === 0
  const quoteReady = quoteStatus === 'ready' && quote?.quantity === quantity

  return (
    <>
      <CheckoutHeader step={1} />
      <main className="checkout-main">
        <div className="product-layout">
          <section className="product-media" aria-label="Product image">
            {!soldOut && (
              <span className="stock-badge">
                {product.stock} units available
              </span>
            )}
            <img
              src="/wireless-headphones.webp"
              width="768"
              height="768"
              alt="Black over-ear wireless headphones"
              fetchPriority="high"
              decoding="async"
            />
          </section>

          <section className="product-card" aria-labelledby="product-title">
            <div className="product-card__intro">
              <p className="eyebrow">Selected product</p>
              <h1 id="product-title">{product.name}</h1>
              <p className="product-description">{product.description}</p>
            </div>

            <div className="purchase-row">
              <div className="unit-price">
                <span>Single unit price</span>
                <strong>{formatMoney(product.priceCents)}</strong>
              </div>
              <div
                className="quantity-control"
                role="group"
                aria-label="Quantity"
              >
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => dispatch(quantityChanged(quantity - 1))}
                  disabled={quantity <= 1 || soldOut}
                >
                  −
                </button>
                <output aria-label="Quantity selected">{quantity}</output>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => dispatch(quantityChanged(quantity + 1))}
                  disabled={soldOut || quantity >= product.stock}
                >
                  +
                </button>
              </div>
            </div>

            <div className="calculation" aria-live="polite">
              <span>Item calculation</span>
              <span>
                {quantity} × {formatMoney(product.priceCents)}
              </span>
            </div>

            {soldOut && (
              <p className="inline-message" role="status">
                Out of stock. Checkout is unavailable.
              </p>
            )}
            {quoteStatus === 'loading' && (
              <p className="inline-message" role="status">
                Calculating your order…
              </p>
            )}
            {quoteStatus === 'error' && (
              <div className="inline-error" role="alert">
                <p>{quoteError}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void dispatch(loadProduct(productId))}
                >
                  Refresh availability
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="checkout-footer">
        <div className="checkout-footer__inner">
          <div className="subtotal">
            <span>
              Product subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})
            </span>
            <strong>
              {quoteReady ? formatMoney(quote.productAmountCents) : '—'}
            </strong>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => dispatch(cardEntryRequested())}
            disabled={soldOut || !quoteReady}
          >
            Pay with credit card
          </button>
        </div>
      </footer>
    </>
  )
}

export default ProductScreen
