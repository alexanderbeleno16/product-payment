import { ApiError, requestJson } from './checkoutApi'
import type { CheckoutQuote } from './checkoutApi'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REFERENCE = /^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAYMENT_STATUSES = [
  'PENDING', 'SUBMISSION_UNKNOWN', 'SUBMISSION_REJECTED',
  'APPROVED', 'DECLINED', 'VOIDED', 'ERROR',
] as const
const FULFILLMENT_STATUSES = ['NOT_STARTED', 'CREATED', 'STOCK_UNAVAILABLE'] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

export interface CreateCheckoutRequest {
  productId: string
  quantity: number
  installments: number
  expectedTotalCents: number
  customerEmail: string
  delivery: { recipientName: string; addressLine: string; city: string }
  cardToken: string
  acceptanceToken: string
  personalDataToken: string
  acceptsEndUserPolicy: true
  acceptsPersonalDataAuthorization: true
}

export interface CheckoutAccepted {
  reference: string
  status: PaymentStatus
  quote: CheckoutQuote
}

export interface CheckoutStatus {
  reference: string
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
}

export class CheckoutTransportError extends Error {
  readonly outcome: 'rejected' | 'unknown' | 'not_found'
  readonly status?: number

  constructor(outcome: 'rejected' | 'unknown' | 'not_found', status?: number) {
    super(outcome === 'rejected' ? 'Checkout request was rejected' :
      outcome === 'not_found' ? 'Checkout was not found' : 'Checkout outcome is unknown')
    this.name = 'CheckoutTransportError'
    this.outcome = outcome
    this.status = status
  }
}

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return PAYMENT_STATUSES.some((status) => status === value)
}

function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return FULFILLMENT_STATUSES.some((status) => status === value)
}

function isQuote(value: unknown): value is CheckoutQuote {
  return isRecord(value) && hasExactKeys(value, [
    'productId', 'quantity', 'currency', 'unitPriceCents',
    'productAmountCents', 'baseFeeCents', 'deliveryFeeCents', 'totalCents',
  ]) && isUuidV4(value.productId) && isPositiveInteger(value.quantity) &&
    value.currency === 'COP' && isNonnegativeInteger(value.unitPriceCents) &&
    isNonnegativeInteger(value.productAmountCents) && isNonnegativeInteger(value.baseFeeCents) &&
    isNonnegativeInteger(value.deliveryFeeCents) && isPositiveInteger(value.totalCents) &&
    value.unitPriceCents * value.quantity === value.productAmountCents &&
    value.productAmountCents + value.baseFeeCents + value.deliveryFeeCents === value.totalCents
}

function isCheckoutAccepted(value: unknown): value is CheckoutAccepted {
  return isRecord(value) && hasExactKeys(value, ['reference', 'status', 'quote']) &&
    typeof value.reference === 'string' && REFERENCE.test(value.reference) &&
    isPaymentStatus(value.status) && isQuote(value.quote)
}

function isCheckoutStatus(value: unknown): value is CheckoutStatus {
  return isRecord(value) && hasExactKeys(value, ['reference', 'paymentStatus', 'fulfillmentStatus']) &&
    typeof value.reference === 'string' && REFERENCE.test(value.reference) &&
    isPaymentStatus(value.paymentStatus) && isFulfillmentStatus(value.fulfillmentStatus)
}

function classifyError(error: unknown): CheckoutTransportError {
  if (error instanceof ApiError) {
    const rejected = [400, 404, 409, 422].includes(error.status)
    return new CheckoutTransportError(rejected ? 'rejected' : 'unknown', error.status)
  }
  return new CheckoutTransportError('unknown')
}

export async function createCheckout(
  request: CreateCheckoutRequest,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<CheckoutAccepted> {
  if (!isUuidV4(idempotencyKey) || !isUuidV4(request.productId) ||
    !isPositiveInteger(request.quantity) || !isPositiveInteger(request.installments) ||
    !isPositiveInteger(request.expectedTotalCents))
    throw new CheckoutTransportError('rejected')
  try {
    const data = await requestJson('/checkouts', signal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        productId: request.productId,
        quantity: request.quantity,
        installments: request.installments,
        expectedTotalCents: request.expectedTotalCents,
        customerEmail: request.customerEmail,
        delivery: {
          recipientName: request.delivery.recipientName,
          addressLine: request.delivery.addressLine,
          city: request.delivery.city,
        },
        cardToken: request.cardToken,
        acceptanceToken: request.acceptanceToken,
        personalDataToken: request.personalDataToken,
        acceptsEndUserPolicy: request.acceptsEndUserPolicy,
        acceptsPersonalDataAuthorization: request.acceptsPersonalDataAuthorization,
      }),
      expectedStatus: 201,
    })
    if (!isCheckoutAccepted(data) || data.quote.productId !== request.productId ||
      data.quote.quantity !== request.quantity || data.quote.totalCents !== request.expectedTotalCents)
      throw new CheckoutTransportError('unknown')
    return data
  } catch (error) {
    if (error instanceof CheckoutTransportError) throw error
    throw classifyError(error)
  }
}

export async function getCheckoutStatus(
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<CheckoutStatus> {
  if (!isUuidV4(idempotencyKey)) throw new CheckoutTransportError('rejected')
  try {
    const data = await requestJson('/checkouts/status', signal, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    if (!isCheckoutStatus(data)) throw new CheckoutTransportError('unknown')
    return data
  } catch (error) {
    if (error instanceof CheckoutTransportError) throw error
    if (error instanceof ApiError && error.status === 404)
      throw new CheckoutTransportError('not_found', 404)
    throw classifyError(error)
  }
}
