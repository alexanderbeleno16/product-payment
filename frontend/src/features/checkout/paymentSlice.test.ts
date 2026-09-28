import { makeStore } from '../../app/store'
import {
  paymentRestored, paymentStarted, paymentStatusReceived, paymentStatusRequested,
  paymentStatusUnavailable,
} from './paymentSlice'

const identity = {
  idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  quantity: 1,
}

test('only the matching status request can settle payment; accepted POST alone cannot', () => {
  const store = makeStore()
  store.dispatch(paymentStarted(identity))
  expect(store.getState().payment.phase).toBe('submitting')
  expect(store.getState().payment.paymentStatus).toBeNull()

  store.dispatch(paymentStatusRequested(identity.idempotencyKey))
  const version = store.getState().payment.requestVersion
  store.dispatch(paymentStatusReceived({
    idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', requestVersion: version,
    status: { reference: 'txn_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', paymentStatus: 'APPROVED', fulfillmentStatus: 'CREATED' },
  }))
  expect(store.getState().payment.phase).toBe('checking')
  store.dispatch(paymentStatusUnavailable({ key: identity.idempotencyKey, requestVersion: version }))
  expect(store.getState().payment.phase).toBe('unknown')

  store.dispatch(paymentStatusRequested(identity.idempotencyKey))
  store.dispatch(paymentStatusReceived({
    idempotencyKey: identity.idempotencyKey, requestVersion: version,
    status: { reference: 'txn_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', paymentStatus: 'APPROVED', fulfillmentStatus: 'CREATED' },
  }))
  expect(store.getState().payment.phase).toBe('checking')
  store.dispatch(paymentStatusReceived({
    idempotencyKey: identity.idempotencyKey, requestVersion: version + 1,
    status: { reference: 'txn_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', paymentStatus: 'APPROVED', fulfillmentStatus: 'STOCK_UNAVAILABLE' },
  }))
  expect(store.getState().payment).toMatchObject({
    phase: 'resolved', paymentStatus: 'APPROVED', fulfillmentStatus: 'STOCK_UNAVAILABLE',
  })
})

test('refresh identity never restores a successful payment from browser state', () => {
  const store = makeStore()
  store.dispatch(paymentRestored(identity))
  expect(store.getState().payment).toMatchObject({
    phase: 'recovering', idempotencyKey: identity.idempotencyKey,
    paymentStatus: null, fulfillmentStatus: null,
  })
})

test('approval without fulfillment remains recoverable until delivery reaches a final state', () => {
  const store = makeStore()
  store.dispatch(paymentRestored(identity))
  store.dispatch(paymentStatusRequested(identity.idempotencyKey))
  const firstVersion = store.getState().payment.requestVersion
  store.dispatch(paymentStatusReceived({
    idempotencyKey: identity.idempotencyKey,
    requestVersion: firstVersion,
    status: { reference: 'txn_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', paymentStatus: 'APPROVED', fulfillmentStatus: 'NOT_STARTED' },
  }))
  expect(store.getState().payment.phase).toBe('pending')
  store.dispatch(paymentStatusRequested(identity.idempotencyKey))
  store.dispatch(paymentStatusReceived({
    idempotencyKey: identity.idempotencyKey,
    requestVersion: store.getState().payment.requestVersion,
    status: { reference: 'txn_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', paymentStatus: 'APPROVED', fulfillmentStatus: 'CREATED' },
  }))
  expect(store.getState().payment).toMatchObject({ phase: 'resolved', fulfillmentStatus: 'CREATED' })
})
