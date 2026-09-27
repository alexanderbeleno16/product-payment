import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import { loadCatalog, productSelected } from './checkoutSlice'
import { getProductImage } from './productImages'

function CatalogScreen() {
  const dispatch = useAppDispatch()
  const { catalog, catalogStatus, catalogError } = useAppSelector(
    (state) => state.checkout,
  )
  const titleRef = useRef<HTMLHeadingElement>(null)
  const returningFromProduct = useRef(catalog.length > 0)

  useEffect(() => {
    if (returningFromProduct.current) titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const request = dispatch(loadCatalog())
    return () => request.abort()
  }, [dispatch])

  return (
    <>
      <CheckoutHeader step={1} />
      <main className="checkout-main catalog-main">
        <div className="catalog-heading">
          <p className="eyebrow">ShopiFast</p>
          <h1 ref={titleRef} tabIndex={-1}>Explora nuestros productos</h1>
          <p>Elige un producto para continuar con una compra rápida y sencilla.</p>
        </div>

        {catalogStatus === 'loading' && catalog.length === 0 && (
          <div className="state-panel" role="status">Cargando productos…</div>
        )}
        {catalogStatus === 'loading' && catalog.length > 0 && (
          <p className="catalog-notice" role="status">Actualizando productos…</p>
        )}
        {catalogStatus === 'error' && catalog.length === 0 && (
          <div className="state-panel" role="alert">
            <h2>No pudimos mostrar los productos</h2>
            <p>{catalogError}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void dispatch(loadCatalog())}
            >
              Volver a intentar
            </button>
          </div>
        )}
        {catalogStatus === 'error' && catalog.length > 0 && (
          <div className="catalog-notice catalog-notice--error" role="alert">
            <p>{catalogError} Los datos visibles pueden haber cambiado.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => void dispatch(loadCatalog())}
            >
              Volver a intentar
            </button>
          </div>
        )}
        {catalogStatus === 'ready' && catalog.length === 0 && (
          <div className="state-panel" role="status">
            No hay productos disponibles en este momento.
          </div>
        )}
        {catalog.length > 0 && (
          <div className="catalog-grid">
            {catalog.map((product) => {
              const image = getProductImage(product.id)
              return (
                <article className="catalog-card" key={product.id}>
                  <div className="catalog-card__media">
                    {image ? (
                      <img
                        src={image.src}
                        alt=""
                        width="768"
                        height="768"
                        decoding="async"
                      />
                    ) : (
                      <span>Imagen no disponible</span>
                    )}
                  </div>
                  <div className="catalog-card__body">
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <strong>{formatMoney(product.priceCents)}</strong>
                    <span className="catalog-card__stock">
                      {product.stock === 0
                        ? 'Agotado'
                        : `${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`}
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => dispatch(productSelected(product.id))}
                    >
                      Ver producto: {product.name}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}

export default CatalogScreen
