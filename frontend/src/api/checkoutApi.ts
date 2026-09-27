import { apiBaseUrl } from './apiBaseUrl'

export interface Product {
  id: string
  name: string
  description: string
  currency: 'COP'
  priceCents: number
  stock: number
}

export interface CheckoutQuote {
  productId: string
  quantity: number
  currency: 'COP'
  unitPriceCents: number
  productAmountCents: number
  baseFeeCents: number
  deliveryFeeCents: number
  totalCents: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    value.currency === 'COP' &&
    isNonnegativeInteger(value.priceCents) &&
    isNonnegativeInteger(value.stock)
  )
}

function isCheckoutQuote(value: unknown): value is CheckoutQuote {
  return (
    isRecord(value) &&
    typeof value.productId === 'string' &&
    value.currency === 'COP' &&
    isNonnegativeInteger(value.quantity) &&
    isNonnegativeInteger(value.unitPriceCents) &&
    isNonnegativeInteger(value.productAmountCents) &&
    isNonnegativeInteger(value.baseFeeCents) &&
    isNonnegativeInteger(value.deliveryFeeCents) &&
    isNonnegativeInteger(value.totalCents)
  )
}

async function readJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<unknown>
}

export async function getProduct(
  id: string,
  signal: AbortSignal,
): Promise<Product> {
  const data = await readJson(`/products/${encodeURIComponent(id)}`, signal)
  if (!isProduct(data) || data.id !== id)
    throw new Error('Invalid product response')
  return data
}

export async function getProducts(signal: AbortSignal): Promise<Product[]> {
  const data = await readJson('/products', signal)
  if (!Array.isArray(data) || !data.every(isProduct))
    throw new Error('Invalid product list response')
  return data
}

export async function getQuote(
  productId: string,
  quantity: number,
  signal: AbortSignal,
): Promise<CheckoutQuote> {
  const query = new URLSearchParams({ productId, quantity: String(quantity) })
  const data = await readJson(`/checkout/quote?${query}`, signal)
  if (
    !isCheckoutQuote(data) ||
    data.productId !== productId ||
    data.quantity !== quantity
  ) {
    throw new Error('Invalid quote response')
  }
  return data
}
