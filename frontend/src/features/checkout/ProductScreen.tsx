import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import {
  cardEntryRequested,
  CHECKOUT_PRODUCT_ID,
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
            Cargando producto…
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
            <h1>Producto no disponible</h1>
            <p>{productError ?? 'No se pudo cargar este producto.'}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void dispatch(loadProduct(productId))}
            >
              Volver a intentar
            </button>
          </div>
        </main>
      </>
    )
  }

  const soldOut = product.stock === 0
  const quoteReady = quoteStatus === 'ready' && quote?.quantity === quantity
  const productName =
    product.id === CHECKOUT_PRODUCT_ID
      ? 'Audífonos inalámbricos'
      : product.name
  const productDescription =
    product.id === CHECKOUT_PRODUCT_ID
      ? 'Audífonos inalámbricos de diadema'
      : product.description

  return (
    <>
      <CheckoutHeader step={1} />
      <main className="checkout-main">
        <div className="product-layout">
          <section className="product-media" aria-label="Imagen del producto">
            {!soldOut && (
              <span className="stock-badge">
                {product.stock}{' '}
                {product.stock === 1
                  ? 'unidad disponible'
                  : 'unidades disponibles'}
              </span>
            )}
            <img
              src="/wireless-headphones.webp"
              width="768"
              height="768"
              alt="Audífonos inalámbricos negros de diadema"
              fetchPriority="high"
              decoding="async"
            />
          </section>

          <section className="product-card" aria-labelledby="product-title">
            <div className="product-card__intro">
              <p className="eyebrow">Producto seleccionado</p>
              <h1 id="product-title">{productName}</h1>
              <p className="product-description">{productDescription}</p>
            </div>

            <div className="purchase-row">
              <div className="unit-price">
                <span>Precio por unidad</span>
                <strong>{formatMoney(product.priceCents)}</strong>
              </div>
              <div
                className="quantity-control"
                role="group"
                aria-label="Cantidad"
              >
                <button
                  type="button"
                  aria-label="Disminuir cantidad"
                  onClick={() => dispatch(quantityChanged(quantity - 1))}
                  disabled={quantity <= 1 || soldOut}
                >
                  −
                </button>
                <output aria-label="Cantidad seleccionada">{quantity}</output>
                <button
                  type="button"
                  aria-label="Aumentar cantidad"
                  onClick={() => dispatch(quantityChanged(quantity + 1))}
                  disabled={soldOut || quantity >= product.stock}
                >
                  +
                </button>
              </div>
            </div>

            <div className="calculation" aria-live="polite">
              <span>Cálculo del producto</span>
              <span>
                {quantity} × {formatMoney(product.priceCents)}
              </span>
            </div>

            {soldOut && (
              <p className="inline-message" role="status">
                Producto agotado. No puedes continuar con la compra.
              </p>
            )}
            {quoteStatus === 'loading' && (
              <p className="inline-message" role="status">
                Calculando tu pedido…
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
                  Actualizar disponibilidad
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
              Subtotal del producto ({quantity} {quantity === 1 ? 'unidad' : 'unidades'})
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
            Pagar con tarjeta de crédito
          </button>
        </div>
      </footer>
    </>
  )
}

export default ProductScreen
