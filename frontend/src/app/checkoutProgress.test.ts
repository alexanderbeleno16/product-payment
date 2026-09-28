import { makeStore } from './store'
import { readCheckoutProgress, writeCheckoutProgress } from './checkoutProgress'
import { loadCatalog, productSelected } from '../features/checkout/checkoutSlice'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'

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
