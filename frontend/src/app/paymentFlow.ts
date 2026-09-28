import { createCheckout, getCheckoutStatus } from '../api/checkoutPaymentApi'
import { CheckoutTransportError } from '../api/checkoutPaymentApi'
import type { CheckoutQuote } from '../api/checkoutApi'
import type { TokenizedCardDelivery } from '../features/checkout/cardForm'
import {
  paymentRestored, paymentStarted, paymentStorageFailed, paymentSubmissionRejected,
  paymentSubmissionUnknown, paymentStatusReceived, paymentStatusRequested,
  paymentStatusUnavailable,
} from '../features/checkout/paymentSlice'
import { hasPaymentRecoveryRecord, readPaymentRecovery, writePaymentRecovery } from './paymentRecovery'
import type { AppDispatch, RootState } from './store'

type GetState = () => RootState
const statusInFlight = new Map<string, Promise<void>>()

export function reconcilePayment(dispatch: AppDispatch, getState: GetState): Promise<void> {
  const current = getState().payment
  const key = current.idempotencyKey
  if (!key || ['idle', 'resolved', 'rejected', 'storage_error'].includes(current.phase))
    return Promise.resolve()
  const existing = statusInFlight.get(key)
  if (existing) return existing
  dispatch(paymentStatusRequested(key))
  const requestVersion = getState().payment.requestVersion
  const request = getCheckoutStatus(key, new AbortController().signal).then((status) => {
    dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion, status }))
  }).catch(() => {
    dispatch(paymentStatusUnavailable({ key, requestVersion }))
  }).finally(() => { statusInFlight.delete(key) })
  statusInFlight.set(key, request)
  return request
}

/** Called only from an explicit confirmation event, never from a render Effect. */
export async function submitPayment(
  prepared: TokenizedCardDelivery,
  displayedQuote: CheckoutQuote,
  dispatch: AppDispatch,
  getState: GetState,
): Promise<boolean> {
  const { checkout, payment } = getState()
  if (payment.phase !== 'idle') return false
  if (!checkout.productId || checkout.step !== 'summary' ||
    displayedQuote.productId !== checkout.productId ||
    displayedQuote.quantity !== checkout.quantity ||
    !Number.isSafeInteger(displayedQuote.totalCents) || displayedQuote.totalCents < 1) return false

  if (hasPaymentRecoveryRecord()) {
    const saved = readPaymentRecovery()
    if (saved) {
      dispatch(paymentRestored(saved))
      await reconcilePayment(dispatch, getState)
    } else dispatch(paymentStorageFailed())
    return false
  }

  let key: string
  try { key = crypto.randomUUID() } catch {
    dispatch(paymentStorageFailed())
    return false
  }
  const identity = { idempotencyKey: key, productId: checkout.productId, quantity: checkout.quantity }
  if (!writePaymentRecovery(identity)) {
    dispatch(paymentStorageFailed())
    return false
  }
  dispatch(paymentStarted(identity))
  try {
    await createCheckout({
      productId: identity.productId,
      quantity: identity.quantity,
      installments: 1,
      expectedTotalCents: displayedQuote.totalCents,
      customerEmail: prepared.customerEmail,
      delivery: prepared.delivery,
      cardToken: prepared.cardToken,
      acceptanceToken: prepared.consentTokens.endUserPolicy,
      personalDataToken: prepared.consentTokens.personalDataAuthorization,
      acceptsEndUserPolicy: prepared.acceptsEndUserPolicy,
      acceptsPersonalDataAuthorization: prepared.acceptsPersonalDataAuthorization,
    }, key, new AbortController().signal)
  } catch (error) {
    if (error instanceof CheckoutTransportError && error.outcome === 'rejected') {
      dispatch(paymentSubmissionRejected(key))
      return true
    }
    dispatch(paymentSubmissionUnknown(key))
  }
  await reconcilePayment(dispatch, getState)
  return true
}
