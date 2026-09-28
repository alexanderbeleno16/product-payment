import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeStore } from '../../app/store'
import { progressRestored } from './checkoutSlice'
import { HEADPHONES_PRODUCT_ID } from './productImages'
import SummaryScreen from './SummaryScreen'

const prepared = {
  cardToken: 'opaque-test-token', cardBrand: 'visa' as const, cardLastFour: '9999',
  acceptsEndUserPolicy: true as const, acceptsPersonalDataAuthorization: true as const,
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
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Total estimado—')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findAllByText('Total estimado')).toHaveLength(2)
  expect(screen.getByRole('contentinfo')).toHaveTextContent('COP')
  expect(screen.getByRole('button', { name: 'Confirmar y pagar' })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})

test('opens a labelled confirmation with fee breakdown and restores focus on cancel', async () => {
  const quote = {
    productId: HEADPHONES_PRODUCT_ID, quantity: 1, currency: 'COP',
    unitPriceCents: 100_000, productAmountCents: 100_000,
    baseFeeCents: 20_000, deliveryFeeCents: 30_000, totalCents: 150_000,
  }
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => quote })
  const store = makeStore()
  store.dispatch(progressRestored({ productId: HEADPHONES_PRODUCT_ID, quantity: 1 }))
  const onConfirm = jest.fn()
  render(<Provider store={store}><SummaryScreen prepared={prepared} onLeave={jest.fn()} onConfirm={onConfirm} /></Provider>)
  const trigger = await screen.findByRole('button', { name: 'Confirmar y pagar' })
  await userEvent.setup().click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Confirma tu pago' })
  expect(dialog).toHaveAccessibleDescription(/Revisa el importe final/)
  expect(screen.getByRole('button', { name: 'Volver al resumen' })).toHaveFocus()
  expect(dialog).toHaveTextContent('Tarifa base')
  expect(dialog).toHaveTextContent('Entrega')
  expect(dialog).toHaveTextContent('COP 1.500')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al resumen' }))
  expect(trigger).toHaveFocus()
  expect(onConfirm).not.toHaveBeenCalled()
  await userEvent.setup().click(trigger)
  await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Enviar pago' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onConfirm).toHaveBeenCalledWith(quote)
})
