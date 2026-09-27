import { useEffect, useId, useRef, useState } from 'react'
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
  const [sortOrder, setSortOrder] = useState<'default' | 'price-desc'>('default')
  const [sortOpen, setSortOpen] = useState(false)
  const sortControlRef = useRef<HTMLDivElement>(null)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)
  const sortLabelId = useId()
  const sortValueId = useId()
  const sortOptionsId = useId()
  const visibleProducts = sortOrder === 'price-desc'
    ? [...catalog].sort((first, second) => second.priceCents - first.priceCents)
    : catalog

  useEffect(() => {
    if (returningFromProduct.current) titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const request = dispatch(loadCatalog())
    return () => request.abort()
  }, [dispatch])

  useEffect(() => {
    if (!sortOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!sortControlRef.current?.contains(event.target as Node)) setSortOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSortOpen(false)
      sortTriggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [sortOpen])

  function chooseSort(order: 'default' | 'price-desc') {
    setSortOrder(order)
    setSortOpen(false)
    sortTriggerRef.current?.focus()
  }

  return (
    <>
      <CheckoutHeader step={1} />
      <main className="checkout-main catalog-main">
        <div className="catalog-heading">
          <p className="eyebrow">Catálogo</p>
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
          <>
            <div className="catalog-sort">
              <span id={sortLabelId} className="catalog-sort__label">Ordenar</span>
              <div
                className="catalog-sort__control"
                ref={sortControlRef}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setSortOpen(false)
                }}
              >
                <button
                  ref={sortTriggerRef}
                  type="button"
                  className="catalog-sort__trigger"
                  aria-labelledby={sortLabelId}
                  aria-describedby={sortValueId}
                  aria-expanded={sortOpen}
                  aria-controls={sortOptionsId}
                  onClick={() => setSortOpen((open) => !open)}
                >
                  <span id={sortValueId}>{sortOrder === 'default' ? 'Orden predeterminado' : 'Precio: mayor a menor'}</span>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {sortOpen && (
                  <div id={sortOptionsId} className="catalog-sort__options" role="group" aria-label="Opciones de orden">
                    <button type="button" aria-pressed={sortOrder === 'default'} onClick={() => chooseSort('default')}>
                      <span>Orden predeterminado</span>
                      {sortOrder === 'default' && <span aria-hidden="true">✓</span>}
                    </button>
                    <button type="button" aria-pressed={sortOrder === 'price-desc'} onClick={() => chooseSort('price-desc')}>
                      <span>Precio: mayor a menor</span>
                      {sortOrder === 'price-desc' && <span aria-hidden="true">✓</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="catalog-grid">
              {visibleProducts.map((product, index) => {
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
                          loading={index < 2 ? 'eager' : 'lazy'}
                          fetchPriority={index === 0 ? 'high' : 'auto'}
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
                      <div className="catalog-card__stock">
                        <span>Stock:</span>
                        <span className={product.stock === 0
                          ? 'catalog-card__stock-value catalog-card__stock-value--empty'
                          : 'catalog-card__stock-value'}>
                          {product.stock === 0 ? '0 · Agotado' : product.stock}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="catalog-card__action"
                      aria-label={`Ver producto: ${product.name}`}
                      onClick={() => dispatch(productSelected(product.id))}
                    />
                  </article>
                )
              })}
            </div>
          </>
        )}
      </main>
    </>
  )
}

export default CatalogScreen
