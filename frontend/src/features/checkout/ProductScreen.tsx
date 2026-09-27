import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import ProductGallery from './ProductGallery'
import { getProductCharacteristics } from './productCharacteristics'
import {
  catalogReturnRequested,
  cardEntryRequested,
  loadProduct,
  loadQuote,
  quantityChanged,
} from './checkoutSlice'

function ProductBreadcrumb({ name }: { name: string }) {
  const dispatch = useAppDispatch()
  return (
    <nav aria-label="Ruta de navegación" className="breadcrumb">
      <button type="button" onClick={() => dispatch(catalogReturnRequested())}>
        Catálogo
      </button>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{name}</span>
    </nav>
  )
}

function ProductScreen() {
  const dispatch = useAppDispatch()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusedProductId = useRef<string | null>(null)
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
    if (!productId) return
    const request = dispatch(loadProduct(productId))
    return () => request.abort()
  }, [dispatch, productId])

  useEffect(() => {
    if (
      !productId ||
      productStatus !== 'ready' ||
      !product ||
      product.id !== productId ||
      product.stock < quantity
    )
      return
    const request = dispatch(loadQuote({ productId, quantity }))
    return () => request.abort()
  }, [dispatch, productId, productStatus, product, quantity])

  useEffect(() => {
    if (
      productStatus === 'ready' &&
      product?.id === productId &&
      focusedProductId.current !== productId
    ) {
      titleRef.current?.focus()
      focusedProductId.current = productId
    }
  }, [productStatus, product, productId])

  if (productStatus === 'idle' || productStatus === 'loading') {
    return (
      <>
        <CheckoutHeader step={1} />
        <main className="checkout-main">
          <ProductBreadcrumb name="Producto" />
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
          <ProductBreadcrumb name="Producto" />
          <div className="state-panel" role="alert">
            <h1>Producto no disponible</h1>
            <p>{productError ?? 'No se pudo cargar este producto.'}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => productId && void dispatch(loadProduct(productId))}
            >
              Volver a intentar
            </button>
          </div>
        </main>
      </>
    )
  }

  const soldOut = product.stock === 0
  const characteristics = getProductCharacteristics(product.id)
  const quoteReady =
    quoteStatus === 'ready' &&
    quote?.quantity === quantity &&
    quote.productId === productId

  return (
    <>
      <CheckoutHeader step={1} />
      <main className="checkout-main">
        <ProductBreadcrumb name={product.name} />
        <div className="product-layout">
          <ProductGallery productId={product.id} productName={product.name} />

          <section className="product-card" aria-labelledby="product-title">
            <div className="product-card__intro">
              <p className="eyebrow">Producto seleccionado</p>
              <h1 id="product-title" ref={titleRef} tabIndex={-1}>{product.name}</h1>
              <div className="product-accordions">
                <details key={`${product.id}-description`} open>
                  <summary>Descripción</summary>
                  <p className="product-description">{product.description}</p>
                </details>
                <details key={`${product.id}-characteristics`}>
                  <summary>Características del producto</summary>
                  {characteristics.length ? (
                    <dl className="product-characteristics">
                      {characteristics.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="product-characteristics__empty">
                      No hay características verificadas para este producto.
                    </p>
                  )}
                </details>
              </div>
              <p className={`stock-badge${soldOut ? ' stock-badge--empty' : ''}`}>
                {soldOut
                  ? 'Agotado'
                  : `${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`}
              </p>
            </div>

            <div className="purchase-row">
              <div className="unit-price">
                <span>Precio por unidad</span>
                <strong>{formatMoney(product.priceCents)}</strong>
              </div>
              <div className="quantity-field">
                <span>Cantidad</span>
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
                  onClick={() => productId && void dispatch(loadProduct(productId))}
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
