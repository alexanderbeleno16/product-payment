import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import CheckoutHeader from './components/CheckoutHeader'
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
            Card & delivery
          </h1>
          <p>Card and delivery details are the next step.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => dispatch(productReturnRequested())}
          >
            Back to product
          </button>
        </div>
      </main>
    </>
  )
}

export default function App() {
  const step = useAppSelector((state) => state.checkout.step)
  return step === 'product' ? <ProductScreen /> : <CardPlaceholder />
}
