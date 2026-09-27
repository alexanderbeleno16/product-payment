import checkoutReducer, {
  cardEntryRequested,
  catalogReturnRequested,
  loadCatalog,
  loadProduct,
  loadQuote,
  productSelected,
  productReturnRequested,
  quantityChanged,
} from './checkoutSlice'
import { HEADPHONES_PRODUCT_ID, SPEAKER_PRODUCT_ID } from './productImages'

const product = {
  id: HEADPHONES_PRODUCT_ID,
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP' as const,
  priceCents: 12_990_000,
  stock: 2,
}

const quote = {
  productId: HEADPHONES_PRODUCT_ID,
  quantity: 1,
  currency: 'COP' as const,
  unitPriceCents: 12_990_000,
  productAmountCents: 12_990_000,
  baseFeeCents: 200_000,
  deliveryFeeCents: 500_000,
  totalCents: 13_690_000,
}

const speaker = {
  ...product,
  id: SPEAKER_PRODUCT_ID,
  name: 'Parlante portátil',
  priceCents: 7_990_000,
  stock: 8,
}

function selectedState() {
  let state = checkoutReducer(undefined, loadCatalog.pending('catalog-1', undefined))
  state = checkoutReducer(
    state,
    loadCatalog.fulfilled([product, speaker], 'catalog-1', undefined),
  )
  return checkoutReducer(state, productSelected(HEADPHONES_PRODUCT_ID))
}

test('allows card entry only after a current server quote, and returns to product', () => {
  let state = checkoutReducer(undefined, cardEntryRequested())
  expect(state.step).toBe('catalog')
  state = selectedState()
  expect(state.step).toBe('product')

  state = checkoutReducer(
    state,
    loadProduct.pending('product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(state, cardEntryRequested())
  expect(state.step).toBe('card')

  state = checkoutReducer(state, productReturnRequested())
  expect(state.step).toBe('product')
})

test('respects stock bounds and invalidates old quotes when quantity changes', () => {
  let state = checkoutReducer(
    selectedState(),
    loadProduct.pending('product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(state, quantityChanged(2))
  expect(state.quantity).toBe(2)
  expect(state.quoteStatus).toBe('idle')

  state = checkoutReducer(state, quantityChanged(3))
  expect(state.quantity).toBe(2)
  state = checkoutReducer(state, quantityChanged(0))
  expect(state.quantity).toBe(2)

  state = checkoutReducer(
    state,
    loadQuote.pending('old', { productId: HEADPHONES_PRODUCT_ID, quantity: 1 }),
  )
  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'old', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  expect(state.quote).toBeNull()
  expect(state.step).toBe('product')
})

test('ignores stale product responses instead of overwriting the current request', () => {
  let state = checkoutReducer(
    selectedState(),
    loadProduct.pending('first', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.pending('second', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'first', HEADPHONES_PRODUCT_ID),
  )
  expect(state.product).toBeNull()
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'second', HEADPHONES_PRODUCT_ID),
  )
  expect(state.product?.stock).toBe(2)
})

test('invalidates an in-flight quote when the product is refreshed', () => {
  let state = checkoutReducer(
    selectedState(),
    loadProduct.pending('product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadProduct.pending('product-2', HEADPHONES_PRODUCT_ID),
  )

  expect(state.quoteRequestId).toBeNull()
  expect(state.quoteStatus).toBe('idle')
  expect(state.quoteError).toBeNull()

  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  expect(state.quote).toBeNull()
  expect(state.quoteStatus).toBe('idle')
})

test('clears an earlier quote error when refreshing the product', () => {
  let state = checkoutReducer(
    selectedState(),
    loadProduct.pending('product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', HEADPHONES_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadQuote.rejected(
      new Error('unavailable'),
      'quote-1',
      { productId: HEADPHONES_PRODUCT_ID, quantity: 1 },
      'No pudimos calcular tu pedido.',
    ),
  )
  expect(state.quoteError).not.toBeNull()

  state = checkoutReducer(
    state,
    loadProduct.pending('product-2', HEADPHONES_PRODUCT_ID),
  )
  expect(state.quoteError).toBeNull()
  expect(state.quoteRequestId).toBeNull()
})

test('switching products resets quantity and ignores late product and quote responses', () => {
  let state = checkoutReducer(selectedState(), loadProduct.pending('old-product', HEADPHONES_PRODUCT_ID))
  state = checkoutReducer(state, loadProduct.fulfilled(product, 'old-product', HEADPHONES_PRODUCT_ID))
  state = checkoutReducer(state, quantityChanged(2))
  state = checkoutReducer(
    state,
    loadQuote.pending('old-quote', { productId: HEADPHONES_PRODUCT_ID, quantity: 2 }),
  )

  state = checkoutReducer(state, catalogReturnRequested())
  expect(state.step).toBe('catalog')
  expect(state.productId).toBeNull()
  expect(state.quoteRequestId).toBeNull()
  state = checkoutReducer(state, productSelected(SPEAKER_PRODUCT_ID))
  expect(state.quantity).toBe(1)
  expect(state.product).toBeNull()
  expect(state.quote).toBeNull()
  expect(state.productRequestId).toBeNull()

  state = checkoutReducer(state, loadProduct.fulfilled(product, 'old-product', HEADPHONES_PRODUCT_ID))
  state = checkoutReducer(
    state,
    loadQuote.fulfilled({ ...quote, quantity: 2 }, 'old-quote', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 2,
    }),
  )
  expect(state.product).toBeNull()
  expect(state.quote).toBeNull()
  state = checkoutReducer(state, cardEntryRequested())
  expect(state.step).toBe('product')
})

test('cannot enter card step with a quote for another product', () => {
  let state = checkoutReducer(selectedState(), loadProduct.pending('product-1', HEADPHONES_PRODUCT_ID))
  state = checkoutReducer(state, loadProduct.fulfilled(product, 'product-1', HEADPHONES_PRODUCT_ID))
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', { productId: HEADPHONES_PRODUCT_ID, quantity: 1 }),
  )
  state = checkoutReducer(
    state,
    loadQuote.fulfilled({ ...quote, productId: SPEAKER_PRODUCT_ID }, 'quote-1', {
      productId: HEADPHONES_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(state, cardEntryRequested())
  expect(state.step).toBe('product')
  expect(state.quote).toBeNull()
})

test('ignores stale catalog response and refuses selection outside the loaded list', () => {
  let state = checkoutReducer(undefined, loadCatalog.pending('first', undefined))
  state = checkoutReducer(state, loadCatalog.pending('second', undefined))
  state = checkoutReducer(state, loadCatalog.fulfilled([product], 'first', undefined))
  expect(state.catalog).toEqual([])
  state = checkoutReducer(state, loadCatalog.fulfilled([speaker], 'second', undefined))
  state = checkoutReducer(state, productSelected(HEADPHONES_PRODUCT_ID))
  expect(state.step).toBe('catalog')
  state = checkoutReducer(state, productSelected(SPEAKER_PRODUCT_ID))
  expect(state.productId).toBe(SPEAKER_PRODUCT_ID)
})
