import { ApiError, getConsentTerms, getProduct, getProducts, getQuote } from './checkoutApi'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'

const product = {
  id: HEADPHONES_PRODUCT_ID,
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

  await expect(getProduct(HEADPHONES_PRODUCT_ID, signal)).resolves.toEqual(
    product,
  )
  expect(fetchMock).toHaveBeenCalledWith(`/products/${HEADPHONES_PRODUCT_ID}`, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
})

test('reads the product catalog and rejects malformed list responses', async () => {
  const fetchMock = jest.mocked(fetch)
  const signal = new AbortController().signal
  fetchMock.mockResolvedValueOnce(response([product]))
  fetchMock.mockResolvedValueOnce(response({ products: [product] }))
  fetchMock.mockResolvedValueOnce(response([{ ...product, stock: -1 }]))

  await expect(getProducts(signal)).resolves.toEqual([product])
  await expect(getProducts(signal)).rejects.toThrow('Invalid product list response')
  await expect(getProducts(signal)).rejects.toThrow('Invalid product list response')
  expect(fetchMock).toHaveBeenCalledWith('/products', {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
})

test('requests the quote for the selected quantity and rejects mismatched data', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValue(
    response({
      productId: HEADPHONES_PRODUCT_ID,
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

  await expect(getQuote(HEADPHONES_PRODUCT_ID, 2, signal)).rejects.toThrow(
    'Invalid quote response',
  )
  expect(fetchMock).toHaveBeenCalledWith(
    `/checkout/quote?productId=${HEADPHONES_PRODUCT_ID}&quantity=2`,
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

  await expect(getProduct(HEADPHONES_PRODUCT_ID, signal)).rejects.toThrow(
    'Invalid product response',
  )
  await expect(getProduct(HEADPHONES_PRODUCT_ID, signal)).rejects.toEqual(
    new ApiError(503),
  )
})

test('rejects a valid product response for a different requested ID', async () => {
  jest.mocked(fetch).mockResolvedValue(
    response({ ...product, id: 'another-product' }),
  )

  await expect(
    getProduct(HEADPHONES_PRODUCT_ID, new AbortController().signal),
  ).rejects.toThrow('Invalid product response')
})

test('reads both current consent documents and rejects malformed or insecure links', async () => {
  const terms = {
    publicKey: 'pub_test_fixture_only',
    endUserPolicy: { token: 'policy-token', permalink: 'https://example.com/policy' },
    personalDataAuthorization: { token: 'data-token', permalink: 'https://example.com/data' },
  }
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response(terms))
  fetchMock.mockResolvedValueOnce(response({ ...terms, endUserPolicy: { ...terms.endUserPolicy, permalink: 'javascript:alert(1)' } }))
  fetchMock.mockResolvedValueOnce(response({ ...terms, personalDataAuthorization: { ...terms.personalDataAuthorization, token: '' } }))

  const signal = new AbortController().signal
  await expect(getConsentTerms(signal)).resolves.toEqual(terms)
  await expect(getConsentTerms(signal)).rejects.toThrow('Invalid consent response')
  await expect(getConsentTerms(signal)).rejects.toThrow('Invalid consent response')
  expect(fetchMock).toHaveBeenCalledWith('/checkout/consents', {
    signal, headers: { Accept: 'application/json' }, cache: 'no-store',
  })
})
