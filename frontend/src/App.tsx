import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import CheckoutHeader from './components/CheckoutHeader'
import CatalogScreen from './features/checkout/CatalogScreen'
import ProductScreen from './features/checkout/ProductScreen'
import { productReturnRequested } from './features/checkout/checkoutSlice'
import './App.css'

function CardPlaceholder() {
  const dispatch = useAppDispatch()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <>
      <CheckoutHeader step={2} />
      <main className="checkout-main">
        <div className="state-panel">
          <h1 ref={titleRef} tabIndex={-1}>
            Tarjeta y entrega
          </h1>
          <p>El ingreso de tarjeta y los datos de entrega aún no están disponibles.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => dispatch(productReturnRequested())}
          >
            Volver al producto
          </button>
        </div>
      </main>
    </>
  )
}

export default function App() {
  const step = useAppSelector((state) => state.checkout.step)
  if (step === 'catalog') return <CatalogScreen />
  return step === 'product' ? <ProductScreen /> : <CardPlaceholder />
}
