import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector, useAppStore } from '../../app/hooks'
import { reconcilePayment } from '../../app/paymentFlow'
import { clearPaymentRecovery, hasPaymentRecoveryRecord } from '../../app/paymentRecovery'
import CheckoutHeader from '../../components/CheckoutHeader'
import { catalogReturnRequested, progressRestored } from './checkoutSlice'
import { paymentReset } from './paymentSlice'
import './PaymentStatusScreen.css'

const MAX_AUTOMATIC_CHECKS = 3

export default function PaymentStatusScreen() {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const payment = useAppSelector((state) => state.payment)

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => {
    if (payment.phase === 'recovering') {
      void reconcilePayment(dispatch, store.getState)
      return
    }
    if (!['pending', 'unknown'].includes(payment.phase) || payment.checks >= MAX_AUTOMATIC_CHECKS)
      return
    const timer = window.setTimeout(() => { void reconcilePayment(dispatch, store.getState) }, 2500)
    return () => window.clearTimeout(timer)
  }, [dispatch, store, payment.phase, payment.checks])

  const approved = payment.paymentStatus === 'APPROVED'
  const fulfilled = approved && payment.fulfillmentStatus === 'CREATED'
  const stockException = approved && payment.fulfillmentStatus === 'STOCK_UNAVAILABLE'
  const failed = payment.phase === 'resolved' && !approved
  const unreadableAttempt = payment.phase === 'storage_error' && hasPaymentRecoveryRecord()
  const canReturn = payment.phase === 'rejected' || failed || fulfilled ||
    (payment.phase === 'storage_error' && !unreadableAttempt)
  const canCheck = ['pending', 'unknown'].includes(payment.phase) || stockException

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
      <section className="payment-status-card" aria-labelledby="payment-status-title">
        <h2 id="payment-status-title">
          {fulfilled ? 'Entrega confirmada' : stockException ? 'Tu pedido necesita atención' :
            approved ? 'Pago aprobado' : failed ? 'Pago no aprobado' :
            payment.phase === 'rejected' ? 'No se inició el pago' :
            payment.phase === 'storage_error' ? 'No se pudo continuar' : 'Confirmando el pago'}
        </h2>
        <div className="payment-status-message" role="status" aria-live="polite">
          {payment.phase === 'submitting' && <p>Enviando la solicitud de pago…</p>}
          {(payment.phase === 'checking' || payment.phase === 'recovering') && <p>Consultando el estado de tu pago…</p>}
          {payment.phase === 'pending' && !approved && <p>Tu pago sigue pendiente de confirmación.</p>}
          {payment.phase === 'unknown' && !approved && <p>No pudimos confirmar el resultado todavía. Conservamos tu solicitud para consultarla sin cobrar de nuevo.</p>}
          {payment.phase === 'unknown' && approved && <p>No pudimos actualizar la entrega todavía. Conservamos la referencia para volver a consultarla.</p>}
          {fulfilled && <p>Pago aprobado y entrega creada.</p>}
          {stockException && <p>El pago fue aprobado, pero no hubo existencias para crear la entrega. Conserva la referencia y contacta a soporte para resolver el pedido. No hagas otra compra de este producto.</p>}
          {approved && !fulfilled && !stockException && <p>Pago aprobado. La entrega aún no está confirmada.</p>}
          {failed && <p>El pago no fue aprobado. Estado: {payment.paymentStatus}.</p>}
          {payment.phase === 'rejected' && <p>La solicitud fue rechazada antes de iniciarse el pago. Vuelve al producto y revisa el precio, la disponibilidad y los datos.</p>}
          {payment.phase === 'storage_error' && <p>{unreadableAttempt
            ? 'Existe una solicitud previa que no podemos leer con seguridad. No enviaremos otro pago. Conserva esta sesión y contacta a soporte.'
            : 'No pudimos guardar la referencia de recuperación. No enviamos el pago.'}</p>}
        </div>
        {payment.reference && <p className="payment-status-reference"><span>Referencia de seguimiento</span><strong>{payment.reference}</strong></p>}
        <div className="payment-status-actions">
          {canCheck &&
            <button type="button" className="secondary-button" disabled={payment.phase === 'checking'}
              onClick={() => { void reconcilePayment(dispatch, store.getState) }}>Consultar estado</button>}
          {canReturn &&
            <button type="button" className="secondary-button" onClick={backToProduct}>Volver al producto</button>}
        </div>
      </section>
    </main>
  </>
}
