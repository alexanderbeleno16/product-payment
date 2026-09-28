import { useState } from 'react'
import { useAppDispatch, useAppSelector, useAppStore } from './app/hooks'
import { submitPayment } from './app/paymentFlow'
import type { CheckoutQuote } from './api/checkoutApi'
import CatalogScreen from './features/checkout/CatalogScreen'
import ProductScreen from './features/checkout/ProductScreen'
import CardDeliveryDialog from './features/checkout/CardDeliveryDialog'
import SummaryScreen from './features/checkout/SummaryScreen'
import PaymentStatusScreen from './features/checkout/PaymentStatusScreen'
import type { TokenizedCardDelivery } from './features/checkout/cardForm'
import { summaryEntered } from './features/checkout/checkoutSlice'
import './App.css'

export default function App() {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const step = useAppSelector((state) => state.checkout.step)
  const paymentPhase = useAppSelector((state) => state.payment.phase)
  const [prepared, setPrepared] = useState<TokenizedCardDelivery | null>(null)
  if (paymentPhase !== 'idle') return <PaymentStatusScreen />
  if (step === 'summary' && prepared) return <SummaryScreen prepared={prepared} onLeave={() => setPrepared(null)}
    onConfirm={(quote: CheckoutQuote) => {
      void submitPayment(prepared, quote, dispatch, store.getState)
      setPrepared(null)
    }} />
  if (step === 'catalog') return <CatalogScreen />
  return (
    <>
      <ProductScreen />
      {step === 'card' && <CardDeliveryDialog onPrepared={(handoff) => {
        setPrepared(handoff)
        dispatch(summaryEntered())
      }} />}
    </>
  )
}
