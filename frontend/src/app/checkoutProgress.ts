import type { RootState } from './store'
import { clearContactProgress } from './contactProgress'

const STORAGE_KEY = 'shopifast-checkout-progress'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface SavedCheckoutProgress {
  productId: string
  quantity: number
  step?: 'card' | 'summary'
}

export function readCheckoutProgress(): SavedCheckoutProgress | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    const legacy = Object.keys(record).sort().join(',') === 'productId,quantity,version' && record.version === 1
    const current = Object.keys(record).sort().join(',') === 'productId,quantity,step,version' &&
      record.version === 2 && (record.step === 'card' || record.step === 'summary')
    if ((!legacy && !current) || typeof record.productId !== 'string' ||
      !UUID_V4.test(record.productId) || typeof record.quantity !== 'number' ||
      !Number.isSafeInteger(record.quantity) || record.quantity < 1) return null
    return { productId: record.productId, quantity: record.quantity,
      ...(current ? { step: record.step as 'card' | 'summary' } : {}) }
  } catch {
    return null
  }
}

export function writeCheckoutProgress(state: RootState): void {
  try {
    const { step, productId, quantity } = state.checkout
    if (step === 'catalog' || !productId) {
      sessionStorage.removeItem(STORAGE_KEY)
      clearContactProgress()
      return
    }
    if (state.payment.phase === 'resolved') clearContactProgress()
    const recoverableStep = step === 'card' || step === 'summary' ? step : null
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(recoverableStep ?
      { version: 2, productId, quantity, step: recoverableStep } : { version: 1, productId, quantity }))
  } catch {
    // Storage may be unavailable; checkout still works without refresh recovery.
  }
}
