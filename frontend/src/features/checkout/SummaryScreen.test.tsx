import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeStore } from '../../app/store'
import { progressRestored } from './checkoutSlice'
import { HEADPHONES_PRODUCT_ID } from './productImages'
import SummaryScreen from './SummaryScreen'

const prepared = {
  cardToken: 'opaque-test-token', cardBrand: 'visa' as const, cardLastFour: '9999',
  customerEmail: 'buyer@example.test',
  delivery: { recipientName: 'Persona de Prueba', addressLine: 'Calle de Prueba 123', city: 'Bogotá' },
  consentTokens: { endUserPolicy: 'policy-test', personalDataAuthorization: 'data-test' },
}

test('blocks stale totals after a failed quote and retries without a payment POST', async () => {
  const quote = {
    productId: HEADPHONES_PRODUCT_ID, quantity: 1, currency: 'COP',
    unitPriceCents: 100_000, productAmountCents: 100_000,
    baseFeeCents: 20_000, deliveryFeeCents: 30_000, totalCents: 150_000,
  }
  const fetchMock = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => quote })
  globalThis.fetch = fetchMock
  const store = makeStore()
  store.dispatch(progressRestored({ productId: HEADPHONES_PRODUCT_ID, quantity: 1 }))
  render(<Provider store={store}><SummaryScreen prepared={prepared} onLeave={jest.fn()} /></Provider>)
  expect(await screen.findByText(/No pudimos actualizar el precio/)).toBeVisible()
  expect(screen.queryByText('Total estimado')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Total estimado')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Confirmar y pagar' })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})
