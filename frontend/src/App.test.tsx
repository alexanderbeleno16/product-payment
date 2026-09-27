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

  expect(screen.getByRole('status')).toHaveTextContent('Loading product')
  expect(
    await screen.findByRole('heading', { name: 'Wireless Headphones' }),
  ).toBeVisible()
  expect(screen.getByText('2 units available')).toBeVisible()
  expect(screen.getByText('Over-ear wireless headphones')).toBeVisible()

  const payButton = screen.getByRole('button', { name: 'Pay with credit card' })
  await waitFor(() => expect(payButton).toBeEnabled())
  expect(screen.getByText('Product subtotal (1 item)')).toBeVisible()
  expect(screen.getAllByText(/COP\s*129,900/).length).toBeGreaterThan(0)
  expect(
    fetchMock.mock.calls.some(([path]) => path.startsWith('/checkout/quote?')),
  ).toBe(true)

  await user.click(payButton)
  expect(screen.getByRole('heading', { name: 'Card & delivery' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Back to product' }))
  expect(
    await screen.findByRole('heading', { name: 'Wireless Headphones' }),
  ).toBeVisible()
})

test('re-quotes quantity and never allows more units than current stock', async () => {
  const fetchMock = installApi()
  const user = userEvent.setup()
  renderCheckout()
  await screen.findByRole('heading', { name: 'Wireless Headphones' })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Pay with credit card' }),
    ).toBeEnabled(),
  )

  await user.click(screen.getByRole('button', { name: 'Increase quantity' }))
  expect(
    screen.getByRole('status', { name: 'Quantity selected' }),
  ).toHaveTextContent('2')
  expect(
    screen.getByRole('button', { name: 'Increase quantity' }),
  ).toBeDisabled()
  await waitFor(() =>
    expect(screen.getByText('Product subtotal (2 items)')).toBeVisible(),
  )
  await waitFor(() =>
    expect(screen.getAllByText(/COP\s*259,800/).length).toBeGreaterThan(0),
  )
  expect(
    fetchMock.mock.calls.some(([path]) => path.includes('quantity=2')),
  ).toBe(true)

  await user.click(screen.getByRole('button', { name: 'Decrease quantity' }))
  expect(
    screen.getByRole('status', { name: 'Quantity selected' }),
  ).toHaveTextContent('1')
  expect(
    screen.getByRole('button', { name: 'Decrease quantity' }),
  ).toBeDisabled()
})

test('does not request a quote or enable checkout for a sold-out product', async () => {
  const fetchMock = installApi(0)
  renderCheckout()

  await screen.findByRole('heading', { name: 'Wireless Headphones' })
  expect(
    screen.getByText('Out of stock. Checkout is unavailable.'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Pay with credit card' }),
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
    await screen.findByRole('heading', { name: 'Product unavailable' }),
  ).toBeVisible()
  expect(
    screen.getByText('We could not load the product. Please try again.'),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('heading', { name: 'Wireless Headphones' }),
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
      'This quantity is no longer available. Refresh the product to continue.',
    ),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Pay with credit card' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Refresh availability' }),
  ).toBeVisible()
})
