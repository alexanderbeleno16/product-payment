const steps = [
  'Producto',
  'Tarjeta y entrega',
  'Resumen',
  'Estado',
  'Producto',
] as const

function CheckoutHeader({ step }: { step: 1 | 2 }) {
  return (
    <header className="checkout-header">
      <div className="checkout-header__top">
        <div className="brand">
          <img
            src="/brand-mark.webp"
            width="256"
            height="256"
            alt="Marca de la tienda"
          />
          <span>Compra</span>
        </div>
        <span className="step-pill">
          Paso {step} de 5 · {steps[step - 1]}
        </span>
      </div>
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
    </header>
  )
}

export default CheckoutHeader
