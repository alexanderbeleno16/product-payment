import '@fontsource/grand-hotel/latin-400.css'
import { useAppDispatch } from '../app/hooks'
import { catalogReturnRequested } from '../features/checkout/checkoutSlice'

const steps = [
  'Producto',
  'Tarjeta y entrega',
  'Resumen',
  'Estado',
  'Producto',
] as const

function CheckoutHeader({ step, onCatalog, catalogEnabled = true }: {
  step: 1 | 2 | 3 | 4
  onCatalog?: () => void
  catalogEnabled?: boolean
}) {
  const dispatch = useAppDispatch()

  return (
    <header className="checkout-header">
      <div className="checkout-header__top">
        <button
          type="button"
          className="brand"
          aria-label="ShopiFast: ir al catálogo"
          disabled={!catalogEnabled}
          onClick={() => { onCatalog?.(); dispatch(catalogReturnRequested()) }}
        >
          <img
            src="/brand-mark.webp"
            width="256"
            height="256"
            alt=""
          />
          <span className="brand__name">ShopiFast</span>
        </button>
        {step > 1 && (
          <span className="step-pill">
            Paso {step} de 5 · {steps[step - 1]}
          </span>
        )}
      </div>
      {step > 1 && (
        <section aria-label="Progreso de la compra" className="checkout-progress">
          <ol>
            {steps.map((label, index) => (
              <li
                key={`${label}-${index}`}
                aria-current={index + 1 === step ? 'step' : undefined}
              >
                <span className="checkout-progress__dot" aria-hidden="true" />
                <span>
                  {index + 1}. {label}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </header>
  )
}

export default CheckoutHeader
