import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CheckoutStatus, FulfillmentStatus, PaymentStatus } from '../../api/checkoutPaymentApi'

type PaymentPhase = 'idle' | 'recovering' | 'submitting' | 'checking' |
  'pending' | 'unknown' | 'resolved' | 'rejected' | 'storage_error'

interface PaymentState {
  phase: PaymentPhase
  idempotencyKey: string | null
  productId: string | null
  quantity: number | null
  reference: string | null
  paymentStatus: PaymentStatus | null
  fulfillmentStatus: FulfillmentStatus | null
  checks: number
  requestVersion: number
}

const initialState: PaymentState = {
  phase: 'idle', idempotencyKey: null, productId: null, quantity: null,
  reference: null, paymentStatus: null, fulfillmentStatus: null,
  checks: 0, requestVersion: 0,
}

interface PaymentIdentity {
  idempotencyKey: string
  productId: string
  quantity: number
}

interface StatusResult {
  idempotencyKey: string
  requestVersion: number
  status: CheckoutStatus
}

const terminalStatuses: PaymentStatus[] = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'SUBMISSION_REJECTED']

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    paymentRestored(_state, action: PayloadAction<PaymentIdentity>) {
      return { ...initialState, ...action.payload, phase: 'recovering' as const }
    },
    paymentStarted(_state, action: PayloadAction<PaymentIdentity>) {
      return { ...initialState, ...action.payload, phase: 'submitting' as const }
    },
    paymentStorageFailed(state) {
      if (state.phase === 'idle') state.phase = 'storage_error'
    },
    paymentSubmissionUnknown(state, action: PayloadAction<string>) {
      if (state.idempotencyKey === action.payload && state.phase === 'submitting')
        state.phase = 'unknown'
    },
    paymentSubmissionRejected(state, action: PayloadAction<string>) {
      if (state.idempotencyKey !== action.payload || state.phase !== 'submitting') return
      state.phase = 'rejected'
    },
    paymentStatusRequested(state, action: PayloadAction<string>) {
      if (state.idempotencyKey !== action.payload ||
        ['idle', 'rejected', 'storage_error', 'resolved'].includes(state.phase)) return
      state.requestVersion += 1
      state.checks += 1
      state.phase = 'checking'
    },
    paymentStatusReceived(state, action: PayloadAction<StatusResult>) {
      if (state.idempotencyKey !== action.payload.idempotencyKey ||
        state.requestVersion !== action.payload.requestVersion || state.phase !== 'checking') return
      const { reference, paymentStatus, fulfillmentStatus } = action.payload.status
      state.reference = reference
      state.paymentStatus = paymentStatus
      state.fulfillmentStatus = fulfillmentStatus
      state.phase = paymentStatus === 'APPROVED' && fulfillmentStatus === 'NOT_STARTED' ? 'pending' :
        terminalStatuses.includes(paymentStatus) ? 'resolved' :
        paymentStatus === 'PENDING' ? 'pending' : 'unknown'
    },
    paymentStatusUnavailable(state, action: PayloadAction<{ key: string; requestVersion: number }>) {
      if (state.idempotencyKey === action.payload.key &&
        state.requestVersion === action.payload.requestVersion && state.phase === 'checking')
        state.phase = 'unknown'
    },
    paymentReset() { return initialState },
  },
})

export const {
  paymentRestored, paymentStarted, paymentStorageFailed, paymentSubmissionUnknown,
  paymentSubmissionRejected, paymentStatusRequested, paymentStatusReceived,
  paymentStatusUnavailable, paymentReset,
} = paymentSlice.actions
export default paymentSlice.reducer
