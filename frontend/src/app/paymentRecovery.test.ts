import {
  clearPaymentRecovery, clearPaymentRecoveryFor, hasPaymentRecoveryRecord, markPaymentSubmissionRejected,
  readPaymentRecovery, writePaymentRecovery,
} from './paymentRecovery'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'

const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const storageKey = 'shopifast-payment-recovery'
const recovery = { productId: HEADPHONES_PRODUCT_ID, quantity: 2, idempotencyKey: key }

beforeEach(() => sessionStorage.clear())

test('synchronously persists only versioned product, quantity and original key', () => {
  const unsafeRecovery = {
    ...recovery,
    cardToken: 'not stored',
    customerEmail: 'not-stored@example.test',
  }
  expect(writePaymentRecovery(unsafeRecovery)).toBe(true)
  expect(sessionStorage.getItem(storageKey)).toBe(JSON.stringify({
    version: 1, productId: HEADPHONES_PRODUCT_ID, quantity: 2, idempotencyKey: key,
  }))
  expect(readPaymentRecovery()).toEqual(recovery)
  clearPaymentRecovery()
  expect(readPaymentRecovery()).toBeNull()
})

test('rejects malformed, obsolete, invalid and expanded stored payloads', () => {
  for (const raw of [
    '{',
    JSON.stringify({ version: 2, ...recovery }),
    JSON.stringify({ version: 2, ...recovery, submissionRejected: true, cardToken: 'forbidden' }),
    JSON.stringify({ version: 1, ...recovery, cardToken: 'forbidden' }),
    JSON.stringify({ version: 1, ...recovery, quantity: 0 }),
    JSON.stringify({ version: 1, ...recovery, idempotencyKey: 'bad' }),
    JSON.stringify({ version: 1, ...recovery, productId: 'bad' }),
  ]) {
    sessionStorage.setItem(storageKey, raw)
    expect(readPaymentRecovery()).toBeNull()
  }
})

test('marks only the same durable identity as definitively rejected', () => {
  expect(writePaymentRecovery(recovery)).toBe(true)
  expect(markPaymentSubmissionRejected('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(false)
  expect(markPaymentSubmissionRejected(key)).toBe(true)
  expect(readPaymentRecovery()).toEqual({ ...recovery, submissionRejected: true })
  expect(sessionStorage.getItem(storageKey)).toBe(JSON.stringify({
    version: 2, ...recovery, submissionRejected: true,
  }))
})

test('clears only the matching key and verifies removal', () => {
  expect(writePaymentRecovery(recovery)).toBe(true)
  expect(clearPaymentRecoveryFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(false)
  expect(readPaymentRecovery()).toEqual(recovery)
  expect(clearPaymentRecoveryFor(key)).toBe(true)
  expect(readPaymentRecovery()).toBeNull()
})

test('unreadable records remain detectable and cannot be silently replaced', () => {
  sessionStorage.setItem(storageKey, '{')
  expect(hasPaymentRecoveryRecord()).toBe(true)
  expect(readPaymentRecovery()).toBeNull()
  expect(markPaymentSubmissionRejected(key)).toBe(false)
  expect(sessionStorage.getItem(storageKey)).toBe('{')
})

test('does not report recovery durability when browser storage fails', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })
  try {
    expect(writePaymentRecovery(recovery)).toBe(false)
  } finally {
    spy.mockRestore()
  }
})

test('rejects invalid identity before any write', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem')
  try {
    expect(writePaymentRecovery({ ...recovery, idempotencyKey: 'bad' })).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  } finally {
    spy.mockRestore()
  }
})
