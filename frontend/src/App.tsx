import { useAppSelector } from './app/hooks'
import CatalogScreen from './features/checkout/CatalogScreen'
import ProductScreen from './features/checkout/ProductScreen'
import CardDeliveryDialog from './features/checkout/CardDeliveryDialog'
import './App.css'

export default function App() {
  const step = useAppSelector((state) => state.checkout.step)
  if (step === 'catalog') return <CatalogScreen />
  return (
    <>
      <ProductScreen />
      {step === 'card' && <CardDeliveryDialog onValid={() => {}} />}
    </>
  )
}
