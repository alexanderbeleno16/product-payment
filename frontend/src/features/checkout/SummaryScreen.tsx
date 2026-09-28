import { useEffect, useRef, useState } from 'react'
import { getQuote } from '../../api/checkoutApi'
import type { CheckoutQuote } from '../../api/checkoutApi'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import type { TokenizedCardDelivery } from './cardForm'
import { productReturnRequested } from './checkoutSlice'
import './SummaryScreen.css'

interface Props {
  prepared: TokenizedCardDelivery
  onLeave: () => void
}

function SummaryScreen({ prepared, onLeave }: Props) {
  const dispatch = useAppDispatch()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { productId, quantity, product } = useAppSelector((state) => state.checkout)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { headingRef.current?.focus() }, [])

  useEffect(() => {
    if (!productId) return
    const controller = new AbortController()
    void getQuote(productId, quantity, controller.signal).then((current) => {
      if (!controller.signal.aborted) {
        setQuote(current)
        setStatus('ready')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })
    return () => controller.abort()
  }, [productId, quantity, attempt])

  function returnToProduct() {
    onLeave()
    dispatch(productReturnRequested())
  }

  return <>
    <CheckoutHeader step={3} onCatalog={onLeave} />
    <main className="checkout-main summary-main">
      <button type="button" className="text-button" onClick={returnToProduct}>← Volver al producto</button>
      <h1 ref={headingRef} tabIndex={-1}>Revisa tu compra</h1>
      <p className="summary-intro">Todavía no se ha realizado ningún cobro. Verifica los datos antes de continuar.</p>
      <div className="summary-layout">
        <section className="summary-card" aria-labelledby="summary-product-title">
          <p className="eyebrow">Tu producto</p>
          <h2 id="summary-product-title">{product?.name ?? 'Producto seleccionado'}</h2>
          <p>{quantity} {quantity === 1 ? 'unidad' : 'unidades'}</p>
          <dl className="summary-lines">
            {status === 'loading' && <div role="status">Actualizando el total con la tienda…</div>}
            {status === 'error' && <div role="alert">
              <p>No pudimos actualizar el precio y la disponibilidad. No se puede continuar con un total anterior.</p>
              <button type="button" className="secondary-button" onClick={() => {
                setStatus('loading')
                setQuote(null)
                setAttempt((value) => value + 1)
              }}>Reintentar</button>
            </div>}
            {status === 'ready' && quote && <>
              <div><dt>Productos</dt><dd>{formatMoney(quote.productAmountCents)}</dd></div>
              <div><dt>Tarifa base</dt><dd>{formatMoney(quote.baseFeeCents)}</dd></div>
              <div><dt>Entrega</dt><dd>{formatMoney(quote.deliveryFeeCents)}</dd></div>
              <div className="summary-lines__total"><dt>Total estimado</dt><dd>{formatMoney(quote.totalCents)}</dd></div>
            </>}
          </dl>
        </section>
        <section className="summary-card" aria-labelledby="summary-delivery-title">
          <p className="eyebrow">Entrega y pago</p>
          <h2 id="summary-delivery-title">Datos de entrega</h2>
          <dl className="summary-lines">
            <div><dt>Recibe</dt><dd>{prepared.delivery.recipientName}</dd></div>
            <div><dt>Dirección</dt><dd>{prepared.delivery.addressLine}, {prepared.delivery.city}</dd></div>
            <div><dt>Contacto</dt><dd>{prepared.customerEmail}</dd></div>
            <div><dt>Tarjeta</dt><dd>{prepared.cardBrand === 'visa' ? 'Visa' : 'Mastercard'} terminada en {prepared.cardLastFour}</dd></div>
          </dl>
        </section>
      </div>
      <p className="summary-next" role="note">La confirmación del pago se habilitará en el siguiente hito. Este resumen no envía una transacción.</p>
    </main>
    <footer className="checkout-footer summary-footer">
      <div className="checkout-footer__inner">
        <div className="subtotal"><span>Total estimado</span><strong>{status === 'ready' && quote ? formatMoney(quote.totalCents) : '—'}</strong></div>
        <button type="button" className="primary-button" disabled>Confirmar y pagar</button>
      </div>
    </footer>
  </>
}

export default SummaryScreen
