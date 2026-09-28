import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector, useAppStore } from '../../app/hooks'
import { reconcilePayment } from '../../app/paymentFlow'
import { clearPaymentRecovery } from '../../app/paymentRecovery'
import CheckoutHeader from '../../components/CheckoutHeader'
import { catalogReturnRequested, progressRestored } from './checkoutSlice'
import { paymentReset } from './paymentSlice'

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

  function backToProduct() {
    if (!['quote_changed', 'rejected', 'storage_error', 'resolved'].includes(payment.phase)) return
    clearPaymentRecovery()
    dispatch(paymentReset())
    const checkout = store.getState().checkout
    const productId = payment.productId ?? checkout.productId
    const quantity = payment.quantity ?? checkout.quantity
    if (productId) dispatch(progressRestored({ productId, quantity }))
    else dispatch(catalogReturnRequested())
  }

  return <>
    <CheckoutHeader step={4} catalogEnabled={false} />
    <main className="checkout-main summary-main">
      <h1 ref={headingRef} tabIndex={-1}>Estado de tu compra</h1>
      <div role="status" aria-live="polite">
        {payment.phase === 'submitting' && <p>Enviando la solicitud de pago…</p>}
        {(payment.phase === 'checking' || payment.phase === 'recovering') && <p>Consultando el estado de tu pago…</p>}
        {payment.phase === 'pending' && !approved && <p>Tu pago sigue pendiente de confirmación.</p>}
        {payment.phase === 'unknown' && <p>No pudimos confirmar el resultado todavía. Conservamos tu solicitud para consultarla sin cobrar de nuevo.</p>}
        {fulfilled && <p>Pago aprobado y entrega creada.</p>}
        {stockException && <p>Pago aprobado, pero no hay existencias para crear la entrega. Necesitamos resolver tu pedido.</p>}
        {approved && !fulfilled && !stockException && <p>Pago aprobado. La entrega aún no está confirmada.</p>}
        {failed && <p>El pago no fue aprobado. Estado: {payment.paymentStatus}.</p>}
        {payment.phase === 'rejected' && <p>La solicitud fue rechazada antes de iniciarse el pago. Vuelve al producto y revisa el precio, la disponibilidad y los datos.</p>}
        {payment.phase === 'storage_error' && <p>No pudimos guardar la referencia de recuperación. No enviamos el pago.</p>}
      </div>
      {payment.reference && <p>Referencia: {payment.reference}</p>}
      {['pending', 'unknown'].includes(payment.phase) &&
        <button type="button" className="secondary-button" onClick={() => { void reconcilePayment(dispatch, store.getState) }}>Consultar estado</button>}
      {['rejected', 'storage_error', 'resolved'].includes(payment.phase) &&
        <button type="button" className="secondary-button" onClick={backToProduct}>Volver al producto</button>}
    </main>
  </>
}
