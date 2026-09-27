import { CompactEncrypt, importSPKI } from 'jose'
import { paymentApiBaseUrl } from './paymentApiBaseUrl'

export interface CardDetails {
  number: string
  cvc: string
  expMonth: string
  expYear: string
  cardHolder: string
}

export type TokenizationFailure = 'configuration' | 'invalid_card' | 'unavailable' | 'invalid_response'

export class TokenizationError extends Error {
  readonly reason: TokenizationFailure

  constructor(reason: TokenizationFailure) {
    super(`Card tokenization ${reason}`)
    this.name = 'TokenizationError'
    this.reason = reason
  }
}

function providerUrl(baseUrl: string, path: string): string {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new TokenizationError('configuration')
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
    url.search || url.hash || !['', '/v1', '/v1/'].includes(url.pathname)) {
    throw new TokenizationError('configuration')
  }
  return `${url.origin}/v1${path}`
}

function validCard(card: CardDetails): boolean {
  return /^\d{13,19}$/.test(card.number) && /^\d{3,4}$/.test(card.cvc) &&
    /^(0[1-9]|1[0-2])$/.test(card.expMonth) && /^\d{2}$/.test(card.expYear) &&
    card.cardHolder.trim().length > 0 && card.cardHolder.length <= 120
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function publicEncryptionKey(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.data) ||
    typeof value.data.publicKey !== 'string' ||
    !/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----$/.test(value.data.publicKey.trim())) {
    throw new TokenizationError('invalid_response')
  }
  return value.data.publicKey
}

function cardToken(value: unknown): string {
  if (!isRecord(value) || value.status !== 'CREATED' ||
    !isRecord(value.data) || typeof value.data.id !== 'string' ||
    !/^tok_[A-Za-z0-9_-]{1,252}$/.test(value.data.id)) {
    throw new TokenizationError('invalid_response')
  }
  return value.data.id
}

async function fetchProvider(url: string, options: RequestInit, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal.reason)
  if (signal.aborted) forwardAbort()
  else signal.addEventListener('abort', forwardAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', forwardAbort)
  }
}

/** Only the compact JWE crosses the card-token endpoint; plaintext stays in this browser call. */
export async function tokenizeCard(
  card: CardDetails,
  merchantPublicKey: string,
  signal: AbortSignal,
  baseUrl: string = paymentApiBaseUrl,
): Promise<string> {
  const keyUrl = providerUrl(baseUrl, '/tokens/keys/tokenization')
  const tokenUrl = providerUrl(baseUrl, '/tokens/cards')
  if (!/^pub_[a-z]+_[A-Za-z0-9_-]+$/.test(merchantPublicKey))
    throw new TokenizationError('configuration')
  if (!validCard(card)) throw new TokenizationError('invalid_card')

  const headers = { Authorization: `Bearer ${merchantPublicKey}`, Accept: 'application/json' }
  let encryptionKey: string
  try {
    const response = await fetchProvider(keyUrl, {
      method: 'GET', headers, cache: 'no-store',
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
    }, signal)
    if (!response.ok) throw new TokenizationError('unavailable')
    encryptionKey = publicEncryptionKey(await response.json() as unknown)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof TokenizationError) throw error
    throw new TokenizationError('unavailable')
  }

  let payload: string
  try {
    const key = await importSPKI(encryptionKey, 'RSA-OAEP-256')
    payload = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify({
      number: card.number,
      cvc: card.cvc,
      exp_month: card.expMonth,
      exp_year: card.expYear,
      card_holder: card.cardHolder,
    })))
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .encrypt(key)
  } catch {
    throw new TokenizationError('invalid_response')
  }
  if (signal.aborted) throw signal.reason

  try {
    const response = await fetchProvider(tokenUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      cache: 'no-store', credentials: 'omit', redirect: 'error',
      referrerPolicy: 'no-referrer',
    }, signal)
    if (!response.ok) throw new TokenizationError('unavailable')
    return cardToken(await response.json() as unknown)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof TokenizationError) throw error
    throw new TokenizationError('unavailable')
  }
}
