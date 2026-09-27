import { ApiError, getProduct, getQuote } from './checkoutApi'
import { CHECKOUT_PRODUCT_ID } from '../features/checkout/checkoutSlice'

const product = {
  id: CHECKOUT_PRODUCT_ID,
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP',
  priceCents: 12_990_000,
  stock: 12,
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: jest.fn(),
    writable: true,
  })
})

test('reads the seeded product with no browser cache', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValue(response(product))
  const signal = new AbortController().signal

  await expect(getProduct(CHECKOUT_PRODUCT_ID, signal)).resolves.toEqual(
    product,
  )
  expect(fetchMock).toHaveBeenCalledWith(`/products/${CHECKOUT_PRODUCT_ID}`, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
})

test('requests the quote for the selected quantity and rejects mismatched data', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValue(
    response({
      productId: CHECKOUT_PRODUCT_ID,
      quantity: 1,
      currency: 'COP',
      unitPriceCents: 12_990_000,
      productAmountCents: 12_990_000,
      baseFeeCents: 200_000,
      deliveryFeeCents: 500_000,
      totalCents: 13_690_000,
    }),
  )
  const signal = new AbortController().signal

  await expect(getQuote(CHECKOUT_PRODUCT_ID, 2, signal)).rejects.toThrow(
    'Invalid quote response',
  )
  expect(fetchMock).toHaveBeenCalledWith(
    `/checkout/quote?productId=${CHECKOUT_PRODUCT_ID}&quantity=2`,
    expect.objectContaining({ signal, cache: 'no-store' }),
  )
})

test('rejects malformed product and HTTP errors without exposing response bodies', async () => {
  const fetchMock = jest.mocked(fetch)
  const signal = new AbortController().signal
  fetchMock.mockResolvedValueOnce(
    response({ ...product, priceCents: '12990000' }),
  )
  fetchMock.mockResolvedValueOnce(
    response({ details: 'internal diagnostic' }, 503),
  )

  await expect(getProduct(CHECKOUT_PRODUCT_ID, signal)).rejects.toThrow(
    'Invalid product response',
  )
  await expect(getProduct(CHECKOUT_PRODUCT_ID, signal)).rejects.toEqual(
    new ApiError(503),
  )
})
