import {
  CheckoutTransportError, createCheckout, getCheckoutStatus,
} from './checkoutPaymentApi'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'

const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reference = `txn_${key}`
const quote = {
  productId: HEADPHONES_PRODUCT_ID,
  quantity: 1,
  currency: 'COP',
  unitPriceCents: 100_000,
  productAmountCents: 100_000,
  baseFeeCents: 2_000,
  deliveryFeeCents: 5_000,
  totalCents: 107_000,
}
const request = {
  productId: HEADPHONES_PRODUCT_ID,
  quantity: 1,
  installments: 1,
  expectedTotalCents: 107_000,
  customerEmail: 'buyer@example.test',
  delivery: { recipientName: 'Test Buyer', addressLine: 'Test Street', city: 'Test City' },
  cardToken: 'transient-card-token',
  acceptanceToken: 'transient-policy-token',
  personalDataToken: 'transient-data-token',
  acceptsEndUserPolicy: true as const,
  acceptsPersonalDataAuthorization: true as const,
}

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true, value: jest.fn(), writable: true,
  })
})

test('POST sends only tokenized checkout fields and the original key without caching', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ reference, status: 'PENDING', quote }, 201))
  const unsafeRequest = {
    ...request,
    delivery: { ...request.delivery, unsafeExtra: 'not sent' },
    rawCardNumber: 'not sent',
  }
  const accepted = await createCheckout(unsafeRequest, key, new AbortController().signal)
  expect(accepted.status).toBe('PENDING')
  const [path, options] = jest.mocked(fetch).mock.calls[0]
  expect(path).toBe('/checkouts')
  expect(options).toMatchObject({
    method: 'POST', cache: 'no-store',
    headers: {
      Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': key,
    },
    signal: expect.any(AbortSignal),
  })
  const body = JSON.parse(String(options?.body)) as Record<string, unknown>
  expect(body).toEqual({
    productId: request.productId, quantity: 1, installments: 1,
    expectedTotalCents: 107_000, customerEmail: request.customerEmail,
    delivery: request.delivery, cardToken: request.cardToken,
    acceptanceToken: request.acceptanceToken, personalDataToken: request.personalDataToken,
    acceptsEndUserPolicy: true, acceptsPersonalDataAuthorization: true,
  })
  expect(String(options?.body)).not.toContain('rawCardNumber')
  expect(String(options?.body)).not.toContain('unsafeExtra')
})

test('does not send POST with an invalid original key', async () => {
  await expect(createCheckout(request, 'not-a-key', new AbortController().signal))
    .rejects.toMatchObject({ outcome: 'rejected' })
  await expect(createCheckout({ ...request, expectedTotalCents: 0 }, key, new AbortController().signal))
    .rejects.toMatchObject({ outcome: 'rejected' })
  expect(fetch).not.toHaveBeenCalled()
})

test('classifies definitive HTTP rejection but treats server failure and malformed acceptance as unknown', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ internal: 'private' }, 409))
  fetchMock.mockResolvedValueOnce(response({ internal: 'private' }, 503))
  fetchMock.mockResolvedValueOnce(response({ reference, status: 'PENDING', quote: { ...quote, totalCents: 999 } }, 201))
  fetchMock.mockResolvedValueOnce(response({ reference, status: 'UNRECOGNIZED', quote }, 201))
  fetchMock.mockResolvedValueOnce(response({ reference, status: 'PENDING', quote, cardToken: 'forbidden' }, 201))
  for (const outcome of ['rejected', 'unknown', 'unknown', 'unknown', 'unknown']) {
    await expect(createCheckout(request, key, new AbortController().signal))
      .rejects.toMatchObject({ outcome })
  }
})

test('treats timeout before headers or during body as unknown, with one 15-second deadline', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => undefined))
    const first = createCheckout(request, key, new AbortController().signal)
    const firstResult = expect(first).rejects.toMatchObject({ outcome: 'unknown' })
    await jest.advanceTimersByTimeAsync(15_000)
    await firstResult

    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true, status: 201, json: () => new Promise<unknown>(() => undefined),
    } as Response)
    const second = createCheckout(request, key, new AbortController().signal)
    const secondResult = expect(second).rejects.toMatchObject({ outcome: 'unknown' })
    await jest.advanceTimersByTimeAsync(15_000)
    await secondResult
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

test('GET reads narrow authoritative status using original key and no cache', async () => {
  const status = { reference, paymentStatus: 'APPROVED', fulfillmentStatus: 'CREATED' }
  jest.mocked(fetch).mockResolvedValue(response(status))
  await expect(getCheckoutStatus(key, new AbortController().signal)).resolves.toEqual(status)
  expect(fetch).toHaveBeenCalledWith('/checkouts/status', {
    signal: expect.any(AbortSignal),
    headers: { Accept: 'application/json', 'Idempotency-Key': key },
    cache: 'no-store',
  })
})

test('status recovery distinguishes missing checkout and rejects unknown or enlarged responses', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({}, 404))
  fetchMock.mockResolvedValueOnce(response({ reference, paymentStatus: 'PAID', fulfillmentStatus: 'CREATED' }))
  fetchMock.mockResolvedValueOnce(response({ reference, paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED', cardToken: 'forbidden' }))
  await expect(getCheckoutStatus(key, new AbortController().signal))
    .rejects.toMatchObject({ outcome: 'not_found', status: 404 })
  await expect(getCheckoutStatus(key, new AbortController().signal))
    .rejects.toMatchObject({ outcome: 'unknown' })
  await expect(getCheckoutStatus(key, new AbortController().signal))
    .rejects.toMatchObject({ outcome: 'unknown' })
  expect(new CheckoutTransportError('unknown').message).not.toContain('forbidden')
})
