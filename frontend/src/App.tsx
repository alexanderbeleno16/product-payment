import { useState } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import CatalogScreen from './features/checkout/CatalogScreen'
import ProductScreen from './features/checkout/ProductScreen'
import CardDeliveryDialog from './features/checkout/CardDeliveryDialog'
import SummaryScreen from './features/checkout/SummaryScreen'
import type { TokenizedCardDelivery } from './features/checkout/cardForm'
import { summaryEntered } from './features/checkout/checkoutSlice'
import './App.css'

export default function App() {
  const dispatch = useAppDispatch()
  const step = useAppSelector((state) => state.checkout.step)
  const [prepared, setPrepared] = useState<TokenizedCardDelivery | null>(null)
  if (step === 'summary' && prepared) return <SummaryScreen prepared={prepared} onLeave={() => setPrepared(null)} />
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
