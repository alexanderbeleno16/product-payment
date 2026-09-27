import { configureStore } from '@reduxjs/toolkit'
import checkoutReducer from '../features/checkout/checkoutSlice'

export function makeStore() {
  return configureStore({ reducer: { checkout: checkoutReducer } })
}

export const store = makeStore()
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
