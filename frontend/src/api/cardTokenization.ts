import { CompactEncrypt, importSPKI } from 'jose'

export interface CardDetails {
  number: string
  cvc: string
  expMonth: string
  expYear: string
  cardHolder: string
}

export type TokenizationFailure =
  'configuration' | 'invalid_card' | 'unavailable' | 'invalid_response'

export class TokenizationError extends Error {
  readonly reason: TokenizationFailure

  constructor(reason: TokenizationFailure) {
    super(`Card tokenization ${reason}`)
    this.name = 'TokenizationError'
    this.reason = reason
  }
}

function validCard(card: CardDetails): boolean {
  return (
    /^\d{13,19}$/.test(card.number) &&
    /^\d{3,4}$/.test(card.cvc) &&
    /^(0[1-9]|1[0-2])$/.test(card.expMonth) &&
    /^\d{2}$/.test(card.expYear) &&
    card.cardHolder.trim().length > 0 &&
    card.cardHolder.length <= 120
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function publicEncryptionKey(value: unknown): string {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    typeof value.data.publicKey !== 'string' ||
    !/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----$/.test(
      value.data.publicKey.trim(),
    )
  ) {
    throw new TokenizationError('invalid_response')
  }
  return value.data.publicKey
}

function cardToken(value: unknown): string {
  if (
    !isRecord(value) ||
    value.status !== 'CREATED' ||
    !isRecord(value.data) ||
    typeof value.data.id !== 'string' ||
    !/^tok_[A-Za-z0-9_-]{1,252}$/.test(value.data.id)
  ) {
    throw new TokenizationError('invalid_response')
  }
  return value.data.id
}

async function fetchBridge(
  url: string,
  options: RequestInit,
  signal: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal.reason)
  if (signal.aborted) forwardAbort()
  else signal.addEventListener('abort', forwardAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let rejectOnAbort: () => void = () => undefined
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason)
  })
  controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
  try {
    if (controller.signal.aborted) throw controller.signal.reason
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal })
        if (!response.ok) throw new TokenizationError('unavailable')
        return (await response.json()) as unknown
      })(),
      aborted,
    ])
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', forwardAbort)
    controller.signal.removeEventListener('abort', rejectOnAbort)
  }
}

/** Only the compact JWE crosses the card-token endpoint; plaintext stays in this browser call. */
export async function tokenizeCard(
  card: CardDetails,
  merchantPublicKey: string,
  signal: AbortSignal,
): Promise<string> {
  if (!/^pub_[a-z]+_[A-Za-z0-9_-]+$/.test(merchantPublicKey))
    throw new TokenizationError('configuration')
  if (!validCard(card)) throw new TokenizationError('invalid_card')

  let encryptionKey: string
  try {
    const body = await fetchBridge(
      '/checkout/tokenization-key',
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      },
      signal,
    )
    encryptionKey = publicEncryptionKey({
      data: body,
    })
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof TokenizationError) throw error
    throw new TokenizationError('unavailable')
  }

  let payload: string
  try {
    const key = await importSPKI(encryptionKey, 'RSA-OAEP-256')
    payload = await new CompactEncrypt(
      new TextEncoder().encode(
        JSON.stringify({
          number: card.number,
          cvc: card.cvc,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          card_holder: card.cardHolder,
        }),
      ),
    )
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .encrypt(key)
  } catch {
    throw new TokenizationError('invalid_response')
  }
  if (signal.aborted) throw signal.reason

  try {
    const body = await fetchBridge(
      '/checkout/card-tokens',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ payload }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      },
      signal,
    )
    if (!isRecord(body)) throw new TokenizationError('invalid_response')
    return cardToken({ status: 'CREATED', data: { id: body.token } })
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof TokenizationError) throw error
    throw new TokenizationError('unavailable')
  }
}
