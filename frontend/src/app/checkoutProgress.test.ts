import { makeStore } from './store'
import { readCheckoutProgress, writeCheckoutProgress } from './checkoutProgress'
import { loadCatalog, productSelected, progressRestored } from '../features/checkout/checkoutSlice'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'
import { readContactProgress, writeContactProgress } from './contactProgress'
import { emptyCardForm } from '../features/checkout/cardForm'

beforeEach(() => sessionStorage.clear())

test('persists only versioned product and quantity, then restores product for a fresh server read', () => {
  const store = makeStore()
  store.dispatch(loadCatalog.pending('catalog', undefined))
  store.dispatch(loadCatalog.fulfilled([{
    id: HEADPHONES_PRODUCT_ID, name: 'Producto', description: 'Descripción',
    currency: 'COP', priceCents: 100_000, stock: 2,
  }], 'catalog', undefined))
  store.dispatch(productSelected(HEADPHONES_PRODUCT_ID))
  writeCheckoutProgress(store.getState())
  const saved = sessionStorage.getItem('shopifast-checkout-progress')
  expect(saved).toBe(JSON.stringify({ version: 1, productId: HEADPHONES_PRODUCT_ID, quantity: 1 }))
  expect(saved).not.toContain('token')
  expect(readCheckoutProgress()).toEqual({ productId: HEADPHONES_PRODUCT_ID, quantity: 1 })

  const reloaded = makeStore(true).getState().checkout
  expect(reloaded.step).toBe('product')
  expect(reloaded.product).toBeNull()
  expect(reloaded.quote).toBeNull()
})

test('rejects obsolete, malformed, or non-allowlisted stored progress', () => {
  for (const value of [
    '{',
    JSON.stringify({ version: 2, productId: HEADPHONES_PRODUCT_ID, quantity: 1 }),
    JSON.stringify({ version: 1, productId: HEADPHONES_PRODUCT_ID, quantity: 1, cardToken: 'forbidden' }),
    JSON.stringify({ version: 1, productId: HEADPHONES_PRODUCT_ID, quantity: 0 }),
    JSON.stringify({ version: 1, productId: 'not-an-id', quantity: 1 }),
  ]) {
    sessionStorage.setItem('shopifast-checkout-progress', value)
    expect(readCheckoutProgress()).toBeNull()
  }
})

test('restores the card stage without any card data', () => {
  const store = makeStore()
  store.dispatch(progressRestored({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, step: 'card' }))
  writeCheckoutProgress(store.getState())
  const saved = sessionStorage.getItem('shopifast-checkout-progress')!
  expect(saved).toBe(JSON.stringify({ version: 2, productId: HEADPHONES_PRODUCT_ID, quantity: 1, step: 'card' }))
  expect(saved).not.toContain('cardToken')
  expect(makeStore(true).getState().checkout.step).toBe('card')
})

test('restores a summary marker without persisting payment credentials', () => {
  const store = makeStore()
  store.dispatch(progressRestored({ productId: HEADPHONES_PRODUCT_ID, quantity: 2, step: 'summary' }))
  writeCheckoutProgress(store.getState())
  const saved = sessionStorage.getItem('shopifast-checkout-progress')!
  expect(saved).toBe(JSON.stringify({ version: 2, productId: HEADPHONES_PRODUCT_ID, quantity: 2, step: 'summary' }))
  expect(saved).not.toMatch(/cardToken|cardHolder|consentToken|cvc|expMonth/)
  const restored = makeStore(true).getState().checkout
  expect(restored.step).toBe('summary')
  expect(restored.product).toBeNull()
  expect(restored.quote).toBeNull()
})

test('clears saved contact when returning to catalog', () => {
  const store = makeStore()
  store.dispatch(progressRestored({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, step: 'card' }))
  writeContactProgress(HEADPHONES_PRODUCT_ID, { ...emptyCardForm, customerEmail: 'buyer@example.test' })
  store.dispatch({ type: 'checkout/catalogReturnRequested' })
  writeCheckoutProgress(store.getState())
  expect(readContactProgress(HEADPHONES_PRODUCT_ID)).toBeNull()
})
