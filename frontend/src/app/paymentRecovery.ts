import { isUuidV4 } from '../api/checkoutPaymentApi'

const STORAGE_KEY = 'shopifast-payment-recovery'

export interface PaymentRecovery {
  productId: string
  quantity: number
  idempotencyKey: string
}

function isRecovery(value: unknown): value is PaymentRecovery & { version: 1 } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join(',') === 'idempotencyKey,productId,quantity,version' &&
    record.version === 1 && isUuidV4(record.productId) && isUuidV4(record.idempotencyKey) &&
    typeof record.quantity === 'number' && Number.isSafeInteger(record.quantity) && record.quantity > 0
}

export function readPaymentRecovery(): PaymentRecovery | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isRecovery(value)) return null
    return {
      productId: value.productId,
      quantity: value.quantity,
      idempotencyKey: value.idempotencyKey,
    }
  } catch {
    return null
  }
}

// A false result must prevent POST: recovery identity cannot be lost after an ambiguous response.
export function writePaymentRecovery(value: PaymentRecovery): boolean {
  if (!isUuidV4(value.productId) || !isUuidV4(value.idempotencyKey) ||
    !Number.isSafeInteger(value.quantity) || value.quantity < 1) return false
  try {
    const serialized = JSON.stringify({
      version: 1,
      productId: value.productId,
      quantity: value.quantity,
      idempotencyKey: value.idempotencyKey,
    })
    sessionStorage.setItem(STORAGE_KEY, serialized)
    return sessionStorage.getItem(STORAGE_KEY) === serialized
  } catch {
    return false
  }
}

export function clearPaymentRecovery(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Browser storage can be unavailable; no sensitive data is retained here.
  }
}
