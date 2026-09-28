import { configureStore } from '@reduxjs/toolkit'
import checkoutReducer from '../features/checkout/checkoutSlice'
import { progressRestored } from '../features/checkout/checkoutSlice'
import { readCheckoutProgress, writeCheckoutProgress } from './checkoutProgress'

export function makeStore(persist = false) {
  const configured = configureStore({ reducer: { checkout: checkoutReducer } })
  if (persist) {
    const saved = readCheckoutProgress()
    if (saved) configured.dispatch(progressRestored(saved))
    configured.subscribe(() => writeCheckoutProgress(configured.getState()))
  }
  return configured
}

export const store = makeStore(true)
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
