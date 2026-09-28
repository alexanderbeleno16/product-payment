import { Provider } from 'react-redux'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { makeStore } from '../../app/store'
import { paymentRestored, paymentStatusReceived, paymentStatusRequested, paymentStatusUnavailable, paymentStorageFailed } from './paymentSlice'
import PaymentStatusScreen from './PaymentStatusScreen'

jest.mock('../../app/paymentFlow', () => ({ reconcilePayment: jest.fn() }))
const { reconcilePayment } = jest.requireMock('../../app/paymentFlow') as { reconcilePayment: jest.Mock }

beforeEach(() => { reconcilePayment.mockReset() })

const key = '8ba8b16d-5e39-4d25-a08d-d2a16df6ae88'

test('shows a five-second cooldown and prevents repeated manual status requests', () => {
  jest.useFakeTimers()
  const store = makeStore()
  store.dispatch(paymentRestored({ idempotencyKey: key, productId: '8a52ea31-08d9-4f52-a604-00e56143dce0', quantity: 1 }))
  store.dispatch(paymentStatusRequested(key))
  store.dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion: 1,
    status: { reference: 'txn-test', paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' } }))
  render(<Provider store={store}><PaymentStatusScreen /></Provider>)
  expect(screen.queryByRole('region', { name: 'Progreso de la compra' })).not.toBeInTheDocument()
  expect(screen.getByText('Paso 4 de 5 · Estado')).toBeVisible()
  const button = screen.getByRole('button', { name: 'Consultar estado' })
  fireEvent.click(button)
  expect(screen.getByRole('button', { name: 'Consultar estado en 5 s' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado en 5 s' }))
  expect(reconcilePayment).toHaveBeenCalledTimes(1)
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeEnabled()
  jest.useRealTimers()
})

test('waits at least two seconds before recovery and each later automatic status request', () => {
  jest.useFakeTimers()
  try {
    const store = makeStore()
    store.dispatch(paymentRestored({ idempotencyKey: key, productId: '8a52ea31-08d9-4f52-a604-00e56143dce0', quantity: 1 }))
    reconcilePayment.mockImplementation(() => {
      store.dispatch(paymentStatusRequested(key))
      store.dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion: store.getState().payment.requestVersion,
        status: { reference: 'txn-test', paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' } }))
    })
    render(<Provider store={store}><PaymentStatusScreen /></Provider>)
    expect(reconcilePayment).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1999) })
    expect(reconcilePayment).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(501) })
    expect(reconcilePayment).toHaveBeenCalledTimes(1)
    act(() => { jest.advanceTimersByTime(1999) })
    expect(reconcilePayment).toHaveBeenCalledTimes(1)
    act(() => { jest.advanceTimersByTime(501) })
    expect(reconcilePayment).toHaveBeenCalledTimes(2)
  } finally { jest.useRealTimers() }
})

test('keeps pending, unknown, and approved-but-unfulfilled messages coherent', () => {
  const store = makeStore()
  store.dispatch(paymentRestored({ idempotencyKey: key, productId: '8a52ea31-08d9-4f52-a604-00e56143dce0', quantity: 1 }))
  store.dispatch(paymentStatusRequested(key))
  store.dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion: 1,
    status: { reference: 'txn-test', paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' } }))
  const view = render(<Provider store={store}><PaymentStatusScreen /></Provider>)
  expect(screen.getByRole('heading', { name: 'Confirmando el pago' })).toBeVisible()
  expect(screen.getByText('Confirmación en curso')).toBeVisible()
  act(() => {
    store.dispatch(paymentStatusRequested(key))
    store.dispatch(paymentStatusUnavailable({ key, requestVersion: 2 }))
  })
  expect(screen.getByRole('heading', { name: 'Resultado aún desconocido' })).toBeVisible()
  expect(screen.getByText('Resultado por confirmar')).toBeVisible()
  act(() => {
    store.dispatch(paymentStatusRequested(key))
    store.dispatch(paymentStatusReceived({ idempotencyKey: key, requestVersion: 3,
      status: { reference: 'txn-test', paymentStatus: 'APPROVED', fulfillmentStatus: 'NOT_STARTED' } }))
  })
  expect(screen.getByRole('heading', { name: 'Entrega en proceso' })).toBeVisible()
  expect(screen.getByText('Pago aprobado · Entrega en proceso')).toBeVisible()
  expect(screen.getByText('Pago aprobado. La entrega aún no está confirmada.')).toBeVisible()
  view.unmount()
})

test('shows storage failures as attention, never as a pending payment', () => {
  const store = makeStore()
  store.dispatch(paymentStorageFailed())
  const view = render(<Provider store={store}><PaymentStatusScreen /></Provider>)
  const card = screen.getByRole('region', { name: 'No se pudo continuar' })
  expect(card).toHaveClass('payment-status-card--attention')
  expect(card).not.toHaveClass('payment-status-card--pending')
  expect(card).toHaveTextContent('Pago no enviado')
  expect(card).toHaveTextContent('No enviamos el pago.')
  expect(card.querySelector('.payment-status-icon')).toHaveTextContent('!')
  view.unmount()

  sessionStorage.setItem('shopifast-payment-recovery', 'unreadable')
  const second = render(<Provider store={store}><PaymentStatusScreen /></Provider>)
  expect(screen.getByText('Pago sin verificar')).toBeVisible()
  expect(screen.getByText(/Existe una solicitud previa/)).toBeVisible()
  second.unmount()
  sessionStorage.clear()
})
