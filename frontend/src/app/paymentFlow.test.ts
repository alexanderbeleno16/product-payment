import { makeStore } from './store'
import { readPaymentRecovery, writePaymentRecovery } from './paymentRecovery'
import { reconcilePayment, submitPayment } from './paymentFlow'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'
import type { CheckoutQuote } from '../api/checkoutApi'
import type { TokenizedCardDelivery } from '../features/checkout/cardForm'

const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reference = `txn_${key}`
const quote: CheckoutQuote = {
  productId: HEADPHONES_PRODUCT_ID, quantity: 1, currency: 'COP',
  unitPriceCents: 100_000, productAmountCents: 100_000,
  baseFeeCents: 2_000, deliveryFeeCents: 5_000, totalCents: 107_000,
}
const prepared: TokenizedCardDelivery = {
  cardToken: 'transient-card-token', cardBrand: 'visa', cardLastFour: '4242',
  acceptsEndUserPolicy: true, acceptsPersonalDataAuthorization: true,
  customerEmail: 'buyer@example.test',
  delivery: { recipientName: 'Test Buyer', addressLine: 'Test Street', city: 'Test City' },
  consentTokens: { endUserPolicy: 'transient-policy', personalDataAuthorization: 'transient-data' },
}

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function readyState(store: ReturnType<typeof makeStore>) {
  return () => ({
    ...store.getState(),
    checkout: { ...store.getState().checkout, step: 'summary' as const, productId: HEADPHONES_PRODUCT_ID, quantity: 1 },
  })
}

beforeEach(() => {
  sessionStorage.clear()
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => key })
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: jest.fn(), writable: true })
})

test('persists original key before one POST; duplicate confirmation cannot initiate another', async () => {
  let resolvePost!: (response: Response) => void
  const pendingPost = new Promise<Response>((resolve) => { resolvePost = resolve })
  jest.mocked(fetch).mockImplementationOnce(async () => {
    expect(readPaymentRecovery()).toMatchObject({ idempotencyKey: key })
    return pendingPost
  }).mockResolvedValueOnce(response({ reference, paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' }))

  const store = makeStore()
  const first = submitPayment(prepared, quote, store.dispatch, readyState(store))
  expect(store.getState().payment.phase).toBe('submitting')
  expect(await submitPayment(prepared, quote, store.dispatch, readyState(store))).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(1)
  resolvePost(response({ reference, status: 'PENDING', quote }, 201))
  expect(await first).toBe(true)
  expect(store.getState().payment).toMatchObject({ phase: 'pending', paymentStatus: 'PENDING' })
  expect(fetch).toHaveBeenCalledTimes(2)
  const serialized = JSON.stringify(store.getState()) + sessionStorage.getItem('shopifast-payment-recovery')
  expect(serialized).not.toContain(prepared.cardToken)
  expect(serialized).not.toContain(prepared.customerEmail)
  expect(serialized).not.toContain(prepared.consentTokens.endUserPolicy)
})

test('storage failure aborts before payment POST', async () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled') })
  try {
    const store = makeStore()
    expect(await submitPayment(prepared, quote, store.dispatch, readyState(store))).toBe(false)
    expect(store.getState().payment.phase).toBe('storage_error')
    expect(fetch).not.toHaveBeenCalled()
  } finally { spy.mockRestore() }
})

test('a 409 conflict is a definitive rejection without guessing its cause', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ code: 'QUOTE_CHANGED' }, 409))
  const store = makeStore()
  expect(await submitPayment(prepared, quote, store.dispatch, readyState(store))).toBe(true)
  expect(store.getState().payment).toMatchObject({ phase: 'rejected', paymentStatus: null })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(readPaymentRecovery()?.idempotencyKey).toBe(key)
})

test('ambiguous POST and 404 reconciliation remain unknown with the original key', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response(null, 503)).mockResolvedValueOnce(response(null, 404))
  const store = makeStore()
  expect(await submitPayment(prepared, quote, store.dispatch, readyState(store))).toBe(true)
  expect(store.getState().payment).toMatchObject({ phase: 'unknown', paymentStatus: null })
  expect(jest.mocked(fetch).mock.calls.map(([path]) => path)).toEqual(['/checkouts', '/checkouts/status'])
  expect(readPaymentRecovery()?.idempotencyKey).toBe(key)
})

test('refresh restores only identity and obtains payment and fulfillment from status GET', async () => {
  expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
  const store = makeStore(true)
  expect(store.getState().payment).toMatchObject({ phase: 'recovering', paymentStatus: null })
  jest.mocked(fetch).mockResolvedValueOnce(response({ reference, paymentStatus: 'APPROVED', fulfillmentStatus: 'STOCK_UNAVAILABLE' }))
  await reconcilePayment(store.dispatch, store.getState)
  expect(store.getState().payment).toMatchObject({
    phase: 'resolved', paymentStatus: 'APPROVED', fulfillmentStatus: 'STOCK_UNAVAILABLE',
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][0]).toBe('/checkouts/status')
})
