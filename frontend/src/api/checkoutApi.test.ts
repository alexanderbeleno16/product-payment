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
    signal: expect.any(AbortSignal),
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
    signal: expect.any(AbortSignal),
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
    expect.objectContaining({ signal: expect.any(AbortSignal), cache: 'no-store' }),
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
    signal: expect.any(AbortSignal), headers: { Accept: 'application/json' }, cache: 'no-store',
  })
})

test('times out a catalog request stalled before response headers', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetch).mockImplementation(() => new Promise<Response>(() => undefined))
    const request = getProducts(new AbortController().signal)
    const result = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
    const fetchSignal = jest.mocked(fetch).mock.calls[0][1]?.signal

    await jest.advanceTimersByTimeAsync(15_000)

    await result
    expect(fetchSignal?.aborted).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

test('times out a product request stalled while reading its JSON body', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => new Promise<unknown>(() => undefined),
    } as Response)
    const request = getProduct(HEADPHONES_PRODUCT_ID, new AbortController().signal)
    const result = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
    const fetchSignal = jest.mocked(fetch).mock.calls[0][1]?.signal

    await jest.advanceTimersByTimeAsync(15_000)

    await result
    expect(fetchSignal?.aborted).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

test('caller cancellation interrupts a quote response body before the deadline', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => new Promise<unknown>(() => undefined),
    } as Response)
    const controller = new AbortController()
    const request = getQuote(HEADPHONES_PRODUCT_ID, 1, controller.signal)
    const fetchSignal = jest.mocked(fetch).mock.calls[0][1]?.signal
    const reason = new DOMException('Request cancelled', 'AbortError')

    controller.abort(reason)

    await expect(request).rejects.toBe(reason)
    expect(fetchSignal?.aborted).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})
