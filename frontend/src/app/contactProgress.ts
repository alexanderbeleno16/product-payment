import type { CardFormValues } from '../features/checkout/cardForm'

const STORAGE_KEY = 'shopifast-contact-progress'
type ContactProgress = Pick<CardFormValues, 'customerEmail' | 'recipientName' | 'addressLine' | 'city'>
const FIELDS = ['customerEmail', 'recipientName', 'addressLine', 'city'] as const
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readContactProgress(productId: string | null): ContactProgress | null {
  if (!productId) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw || raw.length > 1000) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (Object.keys(record).sort().join(',') !== 'addressLine,city,customerEmail,productId,recipientName,version' ||
      record.version !== 1 || record.productId !== productId) return null
    for (const field of FIELDS) {
      if (typeof record[field] !== 'string' || record[field].length > 254) return null
    }
    return { customerEmail: record.customerEmail as string, recipientName: record.recipientName as string,
      addressLine: record.addressLine as string, city: record.city as string }
  } catch { return null }
}

export function writeContactProgress(productId: string | null, values: ContactProgress): void {
  if (!productId || !UUID_V4.test(productId)) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, productId,
      customerEmail: values.customerEmail.slice(0, 254), recipientName: values.recipientName.slice(0, 120),
      addressLine: values.addressLine.slice(0, 240), city: values.city.slice(0, 120) }))
  } catch { /* Private mode may disable storage. */ }
}

export function clearContactProgress(): void {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* Storage is optional. */ }
}
