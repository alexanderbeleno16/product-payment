import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { makeStore } from './app/store'
import { CHECKOUT_PRODUCT_ID } from './features/checkout/checkoutSlice'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const product = {
  id: CHECKOUT_PRODUCT_ID,
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP',
  priceCents: 12_990_000,
  stock: 2,
}

function installApi(stock = 2) {
  const fetchMock = jest.fn(async (input: string) => {
    if (input.startsWith('/products/')) return response({ ...product, stock })
    if (input.startsWith('/checkout/quote?')) {
      const quantity = Number(
        new URL(input, 'http://localhost').searchParams.get('quantity'),
      )
      return response({
        productId: CHECKOUT_PRODUCT_ID,
        quantity,
        currency: 'COP',
        unitPriceCents: product.priceCents,
        productAmountCents: product.priceCents * quantity,
        baseFeeCents: 200_000,
        deliveryFeeCents: 500_000,
        totalCents: product.priceCents * quantity + 700_000,
      })
    }
    return response(null, 404)
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  })
  return fetchMock
}

function renderCheckout() {
  return render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  )
}

test('loads one product and an authoritative quote before enabling card entry', async () => {
  const fetchMock = installApi()
  const user = userEvent.setup()
  renderCheckout()

  expect(screen.getByRole('status')).toHaveTextContent('Cargando producto')
  expect(
    await screen.findByRole('heading', { name: 'Audífonos inalámbricos' }),
  ).toBeVisible()
  expect(screen.getByText('2 unidades disponibles')).toBeVisible()
  expect(screen.getByText('Audífonos inalámbricos de diadema')).toBeVisible()
  expect(
    screen.getByRole('img', {
      name: 'Audífonos inalámbricos negros de diadema',
    }),
  ).toBeVisible()
  expect(screen.getByRole('region', { name: 'Progreso de la compra' })).toBeVisible()
  expect(screen.getByText('Paso 1 de 5 · Producto')).toBeVisible()

  const payButton = screen.getByRole('button', {
    name: 'Pagar con tarjeta de crédito',
  })
  await waitFor(() => expect(payButton).toBeEnabled())
  expect(screen.getByText('Subtotal del producto (1 unidad)')).toBeVisible()
  expect(screen.getAllByText(/COP\s*129\.900/).length).toBeGreaterThan(0)
  expect(
    fetchMock.mock.calls.some(([path]) => path.startsWith('/checkout/quote?')),
  ).toBe(true)

  await user.click(payButton)
  expect(screen.getByRole('heading', { name: 'Tarjeta y entrega' })).toHaveFocus()
  expect(
    screen.getByText(
      'El ingreso de tarjeta y los datos de entrega aún no están disponibles.',
    ),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(
    await screen.findByRole('heading', { name: 'Audífonos inalámbricos' }),
  ).toBeVisible()
})

test('re-quotes quantity and never allows more units than current stock', async () => {
  const fetchMock = installApi()
  const user = userEvent.setup()
  renderCheckout()
  await screen.findByRole('heading', { name: 'Audífonos inalámbricos' })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
    ).toBeEnabled(),
  )

  await user.click(screen.getByRole('button', { name: 'Aumentar cantidad' }))
  expect(
    screen.getByRole('status', { name: 'Cantidad seleccionada' }),
  ).toHaveTextContent('2')
  expect(
    screen.getByRole('button', { name: 'Aumentar cantidad' }),
  ).toBeDisabled()
  await waitFor(() =>
    expect(screen.getByText('Subtotal del producto (2 unidades)')).toBeVisible(),
  )
  await waitFor(() =>
    expect(screen.getAllByText(/COP\s*259\.800/).length).toBeGreaterThan(0),
  )
  expect(
    fetchMock.mock.calls.some(([path]) => path.includes('quantity=2')),
  ).toBe(true)

  await user.click(screen.getByRole('button', { name: 'Disminuir cantidad' }))
  expect(
    screen.getByRole('status', { name: 'Cantidad seleccionada' }),
  ).toHaveTextContent('1')
  expect(
    screen.getByRole('button', { name: 'Disminuir cantidad' }),
  ).toBeDisabled()
})

test('does not request a quote or enable checkout for a sold-out product', async () => {
  const fetchMock = installApi(0)
  renderCheckout()

  await screen.findByRole('heading', { name: 'Audífonos inalámbricos' })
  expect(
    screen.getByText('Producto agotado. No puedes continuar con la compra.'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
  ).toBeDisabled()
  expect(
    fetchMock.mock.calls.every(([path]) => path.startsWith('/products/')),
  ).toBe(true)
})

test('offers a safe retry after product retrieval fails', async () => {
  const fetchMock = installApi()
  fetchMock.mockResolvedValueOnce(response(null, 503))
  const user = userEvent.setup()
  renderCheckout()

  expect(
    await screen.findByRole('heading', { name: 'Producto no disponible' }),
  ).toBeVisible()
  expect(
    screen.getByText('No pudimos cargar el producto. Vuelve a intentarlo.'),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(
    await screen.findByRole('heading', { name: 'Audífonos inalámbricos' }),
  ).toBeVisible()
})

test('blocks progression when the server rejects the quantity', async () => {
  const fetchMock = jest.fn(async (input: string) =>
    input.startsWith('/products/') ? response(product) : response(null, 409),
  )
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  })
  renderCheckout()

  expect(
    await screen.findByText(
      'Esta cantidad ya no está disponible. Actualiza el producto para continuar.',
    ),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Actualizar disponibilidad' }),
  ).toBeVisible()
})
