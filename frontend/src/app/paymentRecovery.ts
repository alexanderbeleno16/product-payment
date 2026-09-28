import { isUuidV4 } from '../api/checkoutPaymentApi'

const STORAGE_KEY = 'shopifast-payment-recovery'

// Unknown or unreadable records must not be overwritten with a new payment identity.
export function hasPaymentRecoveryRecord(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return true
  }
}

export interface PaymentRecovery {
  productId: string
  quantity: number
  idempotencyKey: string
  submissionRejected?: true
}

function isRecovery(value: unknown): value is PaymentRecovery & { version: 1 | 2 } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const versionOne = record.version === 1 &&
    Object.keys(record).sort().join(',') === 'idempotencyKey,productId,quantity,version'
  const versionTwo = record.version === 2 && record.submissionRejected === true &&
    Object.keys(record).sort().join(',') === 'idempotencyKey,productId,quantity,submissionRejected,version'
  return (versionOne || versionTwo) && isUuidV4(record.productId) && isUuidV4(record.idempotencyKey) &&
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
      ...(value.submissionRejected ? { submissionRejected: true as const } : {}),
    }
  } catch {
    return null
  }
}

/** Mark a definitive POST rejection without discarding its identity until status GET confirms absence. */
export function markPaymentSubmissionRejected(idempotencyKey: string): boolean {
  const saved = readPaymentRecovery()
  if (!saved || saved.idempotencyKey !== idempotencyKey) return false
  try {
    const serialized = JSON.stringify({
      version: 2, productId: saved.productId, quantity: saved.quantity,
      idempotencyKey, submissionRejected: true,
    })
    sessionStorage.setItem(STORAGE_KEY, serialized)
    return sessionStorage.getItem(STORAGE_KEY) === serialized
  } catch {
    return false
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

/** Release only the confirmed absent attempt; a failed removal must not enable another POST. */
export function clearPaymentRecoveryFor(idempotencyKey: string): boolean {
  if (readPaymentRecovery()?.idempotencyKey !== idempotencyKey) return false
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    return sessionStorage.getItem(STORAGE_KEY) === null
  } catch {
    return false
  }
}
