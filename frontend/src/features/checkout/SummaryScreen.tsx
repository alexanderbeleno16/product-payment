import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { getQuote } from '../../api/checkoutApi'
import type { CheckoutQuote } from '../../api/checkoutApi'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import CheckoutHeader from '../../components/CheckoutHeader'
import { formatMoney } from '../../lib/formatMoney'
import type { TokenizedCardDelivery } from './cardForm'
import { productReturnRequested } from './checkoutSlice'
import { getProductImage } from './productImages'
import './SummaryScreen.css'

interface Props {
  prepared: TokenizedCardDelivery
  onLeave: () => void
  onConfirm?: (quote: CheckoutQuote) => void
}

function SummaryScreen({ prepared, onLeave, onConfirm }: Props) {
  const dispatch = useAppDispatch()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)
  const confirmTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)
  const confirmationSentRef = useRef(false)
  const { productId, quantity, product } = useAppSelector((state) => state.checkout)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const image = productId ? getProductImage(productId) : null

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

  function closeConfirmation() {
    confirmDialogRef.current?.close()
    confirmTriggerRef.current?.focus()
  }

  function openConfirmation() {
    confirmDialogRef.current?.showModal()
    cancelRef.current?.focus()
  }

  function containConfirmationFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const first = cancelRef.current
    const last = sendRef.current
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
      event.preventDefault()
      first.focus()
    }
  }

  return <>
    <CheckoutHeader step={3} onCatalog={onLeave} />
    <main className="checkout-main summary-main">
      <button type="button" className="text-button" onClick={returnToProduct}>← Volver al producto</button>
      <h1 ref={headingRef} tabIndex={-1}>Revisa tu compra</h1>
      <p className="summary-intro">Confirma tu selección antes de enviar la solicitud de pago. Todavía no se ha realizado ningún cobro.</p>
      <div className="summary-layout">
        <section className="summary-card summary-product" aria-labelledby="summary-product-title">
          {image && <img className="summary-product__image" src={image.src} alt={image.alt} />}
          <div><p className="eyebrow">Tu producto</p>
          <h2 id="summary-product-title">{product?.name ?? 'Producto seleccionado'}</h2>
          <p className="summary-quantity">Cantidad: {quantity} {quantity === 1 ? 'unidad' : 'unidades'}</p></div>
          {status === 'loading' && <p role="status">Actualizando el total con la tienda…</p>}
          {status === 'error' && <div className="summary-error" role="alert">
            <p>No pudimos actualizar el precio y la disponibilidad. No se puede continuar con un total anterior.</p>
            <button type="button" className="secondary-button" onClick={() => {
              setStatus('loading')
              setQuote(null)
              setAttempt((value) => value + 1)
            }}>Reintentar</button>
          </div>}
          {status === 'ready' && quote && <strong className="summary-product__price">{formatMoney(quote.productAmountCents)}</strong>}
        </section>
        <section className="summary-card" aria-labelledby="summary-delivery-title">
          <h2 id="summary-delivery-title">Datos de entrega</h2>
          <dl className="summary-lines">
            <div><dt>Recibe</dt><dd>{prepared.delivery.recipientName}</dd></div>
            <div><dt>Dirección</dt><dd>{prepared.delivery.addressLine}, {prepared.delivery.city}</dd></div>
            <div><dt>Contacto</dt><dd>{prepared.customerEmail}</dd></div>
          </dl>
        </section>
        <section className="summary-card" aria-labelledby="summary-payment-title">
          <h2 id="summary-payment-title">Método de pago</h2>
          <dl className="summary-lines"><div><dt>Tarjeta</dt><dd>{prepared.cardBrand === 'visa' ? 'Visa' : 'Mastercard'} terminada en {prepared.cardLastFour}</dd></div></dl>
          <p className="summary-notice">Enviar el pago inicia la solicitud; el resultado se confirmará en la siguiente pantalla.</p>
        </section>
        <section className="summary-card summary-quote" aria-labelledby="summary-quote-title">
          <h2 id="summary-quote-title">Desglose de la compra</h2>
          <dl className="summary-lines">{status === 'ready' && quote && <>
            <div><dt>Subtotal del producto</dt><dd>{formatMoney(quote.productAmountCents)}</dd></div>
            <div><dt>Tarifa base</dt><dd>{formatMoney(quote.baseFeeCents)}</dd></div>
            <div><dt>Entrega</dt><dd>{formatMoney(quote.deliveryFeeCents)}</dd></div>
            <div className="summary-lines__total"><dt>Total estimado</dt><dd>{formatMoney(quote.totalCents)}</dd></div>
          </>}</dl>
        </section>
      </div>
    </main>
    <footer className="checkout-footer summary-footer">
      <div className="checkout-footer__inner">
        <div className="subtotal"><span>Total estimado</span><strong>{status === 'ready' && quote ? formatMoney(quote.totalCents) : '—'}</strong></div>
        <button ref={confirmTriggerRef} type="button" className="primary-button" disabled={!onConfirm || status !== 'ready' || !quote}
          onClick={openConfirmation}>Confirmar y pagar</button>
      </div>
    </footer>
    <dialog ref={confirmDialogRef} className="payment-confirmation" aria-labelledby="payment-confirm-title"
      aria-describedby="payment-confirm-description"
      onKeyDown={containConfirmationFocus}
      onClose={() => confirmTriggerRef.current?.focus()}>
      <h2 id="payment-confirm-title">Confirma tu pago</h2>
      <p id="payment-confirm-description">Revisa el importe final antes de enviar la solicitud. El resultado se confirmará en la siguiente pantalla.</p>
      {quote && <dl className="payment-confirmation__amounts">
        <div><dt>Producto</dt><dd>{formatMoney(quote.productAmountCents)}</dd></div>
        <div><dt>Tarifa base</dt><dd>{formatMoney(quote.baseFeeCents)}</dd></div>
        <div><dt>Entrega</dt><dd>{formatMoney(quote.deliveryFeeCents)}</dd></div>
        <div className="summary-lines__total"><dt>Total a pagar</dt><dd>{formatMoney(quote.totalCents)}</dd></div>
      </dl>}
      <div className="payment-confirmation__actions">
        <button ref={cancelRef} type="button" className="secondary-button" onClick={closeConfirmation}>Volver al resumen</button>
        <button ref={sendRef} type="button" className="primary-button" onClick={() => {
          if (confirmationSentRef.current || status !== 'ready' || !quote) return
          confirmationSentRef.current = true
          confirmDialogRef.current?.close()
          onConfirm?.(quote)
        }}>Enviar pago</button>
      </div>
    </dialog>
  </>
}

export default SummaryScreen
