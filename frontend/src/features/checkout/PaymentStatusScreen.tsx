import { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector, useAppStore } from '../../app/hooks'
import { reconcilePayment } from '../../app/paymentFlow'
import { clearPaymentRecovery, hasPaymentRecoveryRecord } from '../../app/paymentRecovery'
import CheckoutHeader from '../../components/CheckoutHeader'
import { catalogReturnRequested, progressRestored } from './checkoutSlice'
import { paymentReset } from './paymentSlice'
import { getProductImage } from './productImages'
import { formatMoney } from '../../lib/formatMoney'
import './PaymentStatusScreen.css'

const MAX_AUTOMATIC_CHECKS = 3
const AUTOMATIC_CHECK_DELAY_MS = 2500

export default function PaymentStatusScreen() {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const payment = useAppSelector((state) => state.payment)
  const checkout = useAppSelector((state) => state.checkout)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const cooldownUntilRef = useRef(0)

  useEffect(() => {
    if (cooldownSeconds === 0) return
    const timer = window.setInterval(() => {
      setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntilRef.current - Date.now()) / 1000)))
    }, 200)
    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  useEffect(() => {
    if (document.activeElement === document.body || !document.activeElement?.isConnected)
      headingRef.current?.focus()
  }, [payment.phase])
  useEffect(() => {
    if (!['recovering', 'pending', 'unknown'].includes(payment.phase) ||
      payment.checks >= MAX_AUTOMATIC_CHECKS)
      return
    const timer = window.setTimeout(() => { void reconcilePayment(dispatch, store.getState) }, AUTOMATIC_CHECK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [dispatch, store, payment.phase, payment.checks])

  const approved = payment.paymentStatus === 'APPROVED'
  const fulfilled = approved && payment.fulfillmentStatus === 'CREATED'
  const stockException = approved && payment.fulfillmentStatus === 'STOCK_UNAVAILABLE'
  const failed = payment.phase === 'resolved' && !approved
  const rejected = payment.phase === 'rejected'
  const storageError = payment.phase === 'storage_error'
  const pending = payment.paymentStatus === 'PENDING' || payment.phase === 'pending'
  const unknown = payment.phase === 'unknown'
  const unreadableAttempt = payment.phase === 'storage_error' && hasPaymentRecoveryRecord()
  const canReturn = payment.phase === 'rejected' || failed || fulfilled ||
    (payment.phase === 'storage_error' && !unreadableAttempt)
  const canCheck = ['pending', 'unknown'].includes(payment.phase) || stockException
  const image = payment.productId ? getProductImage(payment.productId) : null
  const product = checkout.productId === payment.productId ? checkout.product : null
  const quote = checkout.productId === payment.productId && checkout.quote?.quantity === payment.quantity
    ? checkout.quote : null

  function checkManually() {
    if (!canCheck || payment.phase === 'checking' || Date.now() < cooldownUntilRef.current) return
    cooldownUntilRef.current = Date.now() + 5000
    setCooldownSeconds(5)
    void reconcilePayment(dispatch, store.getState)
  }

  function backToProduct() {
    if (!canReturn) return
    if (payment.phase !== 'storage_error') clearPaymentRecovery()
    dispatch(paymentReset())
    const checkout = store.getState().checkout
    const productId = payment.productId ?? checkout.productId
    const quantity = payment.quantity ?? checkout.quantity
    if (productId) dispatch(progressRestored({ productId, quantity }))
    else dispatch(catalogReturnRequested())
  }

  return <>
    <CheckoutHeader step={4} catalogEnabled={false} />
    <main className="checkout-main payment-status-main">
      <h1 ref={headingRef} tabIndex={-1}>Estado de tu compra</h1>
      {product && <section className="payment-status-product" aria-label="Producto de la compra">
        {image && <img src={image.src} alt={image.alt} />}
        <div><strong>{product.name}</strong><span>Cantidad: {payment.quantity}</span></div>
        {quote && <strong className="payment-status-product__total">{formatMoney(quote.totalCents)}</strong>}
      </section>}
      <section className={`payment-status-card payment-status-card--${fulfilled ? 'approved' : stockException ? 'attention' : failed || rejected ? 'failed' : 'pending'}`} aria-labelledby="payment-status-title">
        <span className="payment-status-icon" aria-hidden="true">{fulfilled ? '✓' : stockException ? '!' : failed || rejected ? '×' : '⌛'}</span>
        <p className="payment-status-pill">{fulfilled ? 'Pago aprobado' : stockException ? 'Pago aprobado · Entrega pendiente' : approved ? 'Pago aprobado · Entrega en proceso' : failed ? 'Pago no aprobado' : rejected ? 'Pago no iniciado' : storageError ? unreadableAttempt ? 'Pago sin verificar' : 'Pago no enviado' : unknown ? 'Resultado por confirmar' : 'Confirmación en curso'}</p>
        <h2 id="payment-status-title">
          {fulfilled ? 'Entrega confirmada' : stockException ? 'Tu pedido necesita atención' :
            approved ? 'Entrega en proceso' : failed ? 'Pago no aprobado' :
            rejected ? 'No se inició el pago' :
            storageError ? 'No se pudo continuar' : unknown ? 'Resultado aún desconocido' :
            pending ? 'Confirmando el pago' : 'Verificando tu pago'}
        </h2>
        <div className="payment-status-message" role="status" aria-live="polite">
          {fulfilled && <p>Pago aprobado y entrega creada.</p>}
          {stockException && <p>El pago fue aprobado, pero no hubo existencias para crear la entrega. Conserva la referencia y contacta a soporte para resolver el pedido. No hagas otra compra de este producto.</p>}
          {approved && !fulfilled && !stockException && <p>Pago aprobado. La entrega aún no está confirmada.</p>}
          {failed && <p>El pago no fue aprobado. Estado: {payment.paymentStatus}.</p>}
          {rejected && <p>La solicitud fue rechazada antes de iniciarse el pago. Vuelve al producto y revisa el precio, la disponibilidad y los datos.</p>}
          {storageError && <p>{unreadableAttempt
            ? 'Existe una solicitud previa que no podemos leer con seguridad. No enviaremos otro pago. Conserva esta sesión y contacta a soporte.'
            : 'No pudimos guardar la referencia de recuperación. No enviamos el pago.'}</p>}
          {!approved && !failed && !rejected && !storageError && (unknown
            ? <p>No pudimos confirmar el resultado todavía. Conservamos tu solicitud para consultarla sin cobrar de nuevo.</p>
            : pending
              ? <p>Recibimos tu solicitud. El pago sigue pendiente de confirmación. No intentes pagar de nuevo mientras esperamos el resultado.</p>
              : <p>{payment.phase === 'submitting' ? 'Enviando la solicitud de pago…' : 'Consultando el estado de tu pago…'}</p>)}
        </div>
        {payment.reference && <p className="payment-status-reference"><span>Referencia de seguimiento</span><strong>{payment.reference}</strong></p>}
      </section>
      <div className="payment-status-actions">
        {canCheck && <button type="button" className="primary-button"
          disabled={payment.phase === 'checking' || cooldownSeconds > 0}
          onClick={checkManually}>{cooldownSeconds > 0 ? `Consultar estado en ${cooldownSeconds} s` : 'Consultar estado'}</button>}
        {canReturn && <button type="button" className="primary-button" onClick={backToProduct}>Volver al producto</button>}
      </div>
    </main>
  </>
}
