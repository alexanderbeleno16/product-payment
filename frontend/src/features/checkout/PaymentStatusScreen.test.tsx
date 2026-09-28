import { Provider } from 'react-redux'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { makeStore } from '../../app/store'
import { paymentRestored, paymentStatusReceived, paymentStatusRequested } from './paymentSlice'
import PaymentStatusScreen from './PaymentStatusScreen'

jest.mock('../../app/paymentFlow', () => ({ reconcilePayment: jest.fn() }))

const key = '8ba8b16d-5e39-4d25-a08d-d2a16df6ae88'

test('shows a five-second cooldown and prevents repeated manual status requests', () => {
  jest.useFakeTimers()
  const store = makeStore()
  store.dispatch(paymentRestored({ idempotencyKey: key, productId: '8a52ea31-08d9-4f52-a604-00e56143dce0', quantity: 1 }))
  store.dispatch(paymentStatusRequested(key))
  store.dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion: 1,
    status: { reference: 'txn-test', paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' } }))
  render(<Provider store={store}><PaymentStatusScreen /></Provider>)
  const button = screen.getByRole('button', { name: 'Consultar estado' })
  fireEvent.click(button)
  expect(screen.getByRole('button', { name: 'Consultar estado en 5 s' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado en 5 s' }))
  const { reconcilePayment } = jest.requireMock('../../app/paymentFlow') as { reconcilePayment: jest.Mock }
  expect(reconcilePayment).toHaveBeenCalledTimes(1)
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeEnabled()
  jest.useRealTimers()
})
