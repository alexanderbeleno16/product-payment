import { configureStore } from '@reduxjs/toolkit'
import checkoutReducer from '../features/checkout/checkoutSlice'
import paymentReducer, { paymentRestored } from '../features/checkout/paymentSlice'
import { progressRestored } from '../features/checkout/checkoutSlice'
import { readCheckoutProgress, writeCheckoutProgress } from './checkoutProgress'
import { readPaymentRecovery } from './paymentRecovery'

export function makeStore(persist = false) {
  const configured = configureStore({ reducer: { checkout: checkoutReducer, payment: paymentReducer } })
  if (persist) {
    const saved = readCheckoutProgress()
    if (saved) configured.dispatch(progressRestored(saved))
    const payment = readPaymentRecovery()
    if (payment) configured.dispatch(paymentRestored(payment))
    configured.subscribe(() => writeCheckoutProgress(configured.getState()))
  }
  return configured
}

export const store = makeStore(true)
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
