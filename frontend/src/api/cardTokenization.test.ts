import { CompactEncrypt, importSPKI } from 'jose'
import { tokenizeCard, TokenizationError } from './cardTokenization'

jest.mock('jose', () => ({
  importSPKI: jest.fn(),
  CompactEncrypt: jest.fn(),
}))
jest.mock('./paymentApiBaseUrl', () => ({ paymentApiBaseUrl: '' }))

const card = {
  number: '4'.repeat(16),
  cvc: '1'.repeat(3),
  expMonth: '08',
  expYear: '30',
  cardHolder: 'Fixture Holder',
}
const merchantKey = 'pub_test_fixture_only'
const baseUrl = 'https://payments.example.com/v1'
const signal = new AbortController().signal
const encryptionKey = '-----BEGIN PUBLIC KEY-----\nZmFrZQ==\n-----END PUBLIC KEY-----'

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: class {
      encode(text: string) { return new Uint8Array([...text].map((character) => character.charCodeAt(0))) }
    },
  })
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: jest.fn(), writable: true })
  jest.mocked(importSPKI).mockResolvedValue({} as never)
  jest.mocked(CompactEncrypt).mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    encrypt: jest.fn().mockResolvedValue('header.encrypted.key.ciphertext.tag'),
  }) as never)
})

afterEach(() => jest.clearAllMocks())

test('encrypts card data in the browser and posts only a compact JWE', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ data: { publicKey: encryptionKey } }))
  fetchMock.mockResolvedValueOnce(response({ status: 'CREATED', data: { id: 'tok_test_fixture' } }, 201))

  await expect(tokenizeCard(card, merchantKey, signal, baseUrl)).resolves.toBe('tok_test_fixture')
  expect(fetchMock).toHaveBeenNthCalledWith(1,
    'https://payments.example.com/v1/tokens/keys/tokenization',
    expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal), credentials: 'omit', redirect: 'error' }),
  )
  expect(importSPKI).toHaveBeenCalledWith(encryptionKey, 'RSA-OAEP-256')
  const encryptor = jest.mocked(CompactEncrypt).mock.results[0].value as {
    setProtectedHeader: jest.Mock
  }
  expect(encryptor.setProtectedHeader).toHaveBeenCalledWith({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
  expect(fetchMock).toHaveBeenNthCalledWith(2,
    'https://payments.example.com/v1/tokens/cards',
    expect.objectContaining({
      method: 'POST', credentials: 'omit', redirect: 'error',
      signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ Authorization: `Bearer ${merchantKey}` }),
      body: JSON.stringify({ payload: 'header.encrypted.key.ciphertext.tag' }),
    }),
  )
  expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(card.number)
  expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(card.cvc)
})

test('rejects insecure configuration and malformed card before any network call', async () => {
  await expect(tokenizeCard(card, merchantKey, signal, 'http://payments.example.com/v1'))
    .rejects.toEqual(new TokenizationError('configuration'))
  await expect(tokenizeCard({ ...card, cvc: 'x' }, merchantKey, signal, baseUrl))
    .rejects.toEqual(new TokenizationError('invalid_card'))
  await expect(tokenizeCard(card, 'private_fixture', signal, baseUrl))
    .rejects.toEqual(new TokenizationError('configuration'))
  expect(fetch).not.toHaveBeenCalled()
})

test('rejects malformed key and token responses without exposing provider bodies', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ data: { publicKey: 'not-a-key' } }))
  await expect(tokenizeCard(card, merchantKey, signal, baseUrl))
    .rejects.toEqual(new TokenizationError('invalid_response'))
  expect(fetchMock).toHaveBeenCalledTimes(1)

  fetchMock.mockResolvedValueOnce(response({ data: { publicKey: encryptionKey } }))
  fetchMock.mockResolvedValueOnce(response({ status: 'CREATED', data: { id: 'bad' } }))
  await expect(tokenizeCard(card, merchantKey, signal, baseUrl))
    .rejects.toEqual(new TokenizationError('invalid_response'))
})

test('maps provider failures to safe errors and does not post after abort', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ diagnostic: card.number }, 503))
  await expect(tokenizeCard(card, merchantKey, signal, baseUrl))
    .rejects.toEqual(new TokenizationError('unavailable'))
  expect(fetchMock).toHaveBeenCalledTimes(1)

  const controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response({ data: { publicKey: encryptionKey } }))
  jest.mocked(importSPKI).mockImplementationOnce(async () => {
    controller.abort()
    return {} as never
  })
  await expect(tokenizeCard(card, merchantKey, controller.signal, baseUrl)).rejects.toBeDefined()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('times out a stalled provider request without sending card details', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('stalled request')))
    }))
    const result = tokenizeCard(card, merchantKey, signal, baseUrl)
    const assertion = expect(result).rejects.toEqual(new TokenizationError('unavailable'))
    await jest.advanceTimersByTimeAsync(15_000)
    await assertion
    expect(fetch).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})
