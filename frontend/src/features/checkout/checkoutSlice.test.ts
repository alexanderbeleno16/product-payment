import checkoutReducer, {
  cardEntryRequested,
  CHECKOUT_PRODUCT_ID,
  loadProduct,
  loadQuote,
  productReturnRequested,
  quantityChanged,
} from './checkoutSlice'

const product = {
  id: CHECKOUT_PRODUCT_ID,
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP' as const,
  priceCents: 12_990_000,
  stock: 2,
}

const quote = {
  productId: CHECKOUT_PRODUCT_ID,
  quantity: 1,
  currency: 'COP' as const,
  unitPriceCents: 12_990_000,
  productAmountCents: 12_990_000,
  baseFeeCents: 200_000,
  deliveryFeeCents: 500_000,
  totalCents: 13_690_000,
}

test('allows card entry only after a current server quote, and returns to product', () => {
  let state = checkoutReducer(undefined, cardEntryRequested())
  expect(state.step).toBe('product')

  state = checkoutReducer(
    state,
    loadProduct.pending('product-1', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', {
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'quote-1', {
      productId: CHECKOUT_PRODUCT_ID,
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
    undefined,
    loadProduct.pending('product-1', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', CHECKOUT_PRODUCT_ID),
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
    loadQuote.pending('old', { productId: CHECKOUT_PRODUCT_ID, quantity: 1 }),
  )
  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'old', {
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
    }),
  )
  expect(state.quote).toBeNull()
  expect(state.step).toBe('product')
})

test('ignores stale product responses instead of overwriting the current request', () => {
  let state = checkoutReducer(
    undefined,
    loadProduct.pending('first', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.pending('second', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'first', CHECKOUT_PRODUCT_ID),
  )
  expect(state.product).toBeNull()
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'second', CHECKOUT_PRODUCT_ID),
  )
  expect(state.product?.stock).toBe(2)
})

test('invalidates an in-flight quote when the product is refreshed', () => {
  let state = checkoutReducer(
    undefined,
    loadProduct.pending('product-1', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadProduct.fulfilled(product, 'product-1', CHECKOUT_PRODUCT_ID),
  )
  state = checkoutReducer(
    state,
    loadQuote.pending('quote-1', {
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadProduct.pending('product-2', CHECKOUT_PRODUCT_ID),
  )

  expect(state.quoteRequestId).toBeNull()
  expect(state.quoteStatus).toBe('idle')
  expect(state.quoteError).toBeNull()

  state = checkoutReducer(
    state,
    loadQuote.fulfilled(quote, 'quote-1', {
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
    }),
  )
  expect(state.quote).toBeNull()
  expect(state.quoteStatus).toBe('idle')
})

test('clears an earlier quote error when refreshing the product', () => {
  let state = checkoutReducer(
    undefined,
    loadQuote.pending('quote-1', {
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
    }),
  )
  state = checkoutReducer(
    state,
    loadQuote.rejected(
      new Error('unavailable'),
      'quote-1',
      { productId: CHECKOUT_PRODUCT_ID, quantity: 1 },
      'No pudimos calcular tu pedido.',
    ),
  )
  expect(state.quoteError).not.toBeNull()

  state = checkoutReducer(
    state,
    loadProduct.pending('product-2', CHECKOUT_PRODUCT_ID),
  )
  expect(state.quoteError).toBeNull()
  expect(state.quoteRequestId).toBeNull()
})
