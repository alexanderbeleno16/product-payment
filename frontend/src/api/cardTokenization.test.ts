import { CompactEncrypt, importSPKI } from 'jose'
import { tokenizeCard, TokenizationError } from './cardTokenization'

jest.mock('jose', () => ({ importSPKI: jest.fn(), CompactEncrypt: jest.fn() }))
const card = {
  number: '4'.repeat(16),
  cvc: '123',
  expMonth: '08',
  expYear: '30',
  cardHolder: 'Fixture Holder',
}
const key = 'pub_stagtest_fixture_only'
const pem = '-----BEGIN PUBLIC KEY-----\nZmFrZQ==\n-----END PUBLIC KEY-----'
const signal = new AbortController().signal
const response = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response
beforeEach(() => {
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: class {
      encode(text: string) {
        return new Uint8Array(
          [...text].map((character) => character.charCodeAt(0)),
        )
      }
    },
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: jest.fn(),
    writable: true,
  })
  jest.mocked(importSPKI).mockResolvedValue({} as never)
  jest.mocked(CompactEncrypt).mockImplementation(
    () =>
      ({
        setProtectedHeader: jest.fn().mockReturnThis(),
        encrypt: jest
          .fn()
          .mockResolvedValue('header.encrypted.key.ciphertext.tag'),
      }) as never,
  )
})
afterEach(() => jest.clearAllMocks())

test('browser encrypts and posts only compact JWE to same-origin API', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ publicKey: pem }))
  fetchMock.mockResolvedValueOnce(response({ token: 'tok_test_fixture' }, 201))
  await expect(tokenizeCard(card, key, signal)).resolves.toBe(
    'tok_test_fixture',
  )
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    '/checkout/tokenization-key',
    expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    }),
  )
  expect(importSPKI).toHaveBeenCalledWith(pem, 'RSA-OAEP-256')
  const encryptor = jest.mocked(CompactEncrypt).mock.results[0].value as {
    setProtectedHeader: jest.Mock
  }
  expect(encryptor.setProtectedHeader).toHaveBeenCalledWith({
    alg: 'RSA-OAEP-256',
    enc: 'A256GCM',
  })
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/checkout/card-tokens',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ payload: 'header.encrypted.key.ciphertext.tag' }),
      credentials: 'omit',
      redirect: 'error',
    }),
  )
  expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(card.number)
  expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(card.cvc)
  expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(key)
})

test('rejects malformed card and key before network', async () => {
  await expect(
    tokenizeCard({ ...card, cvc: 'x' }, key, signal),
  ).rejects.toEqual(new TokenizationError('invalid_card'))
  await expect(tokenizeCard(card, 'private_fixture', signal)).rejects.toEqual(
    new TokenizationError('configuration'),
  )
  expect(fetch).not.toHaveBeenCalled()
})

test('rejects malformed key and token response', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ publicKey: 'invalid' }))
  await expect(tokenizeCard(card, key, signal)).rejects.toEqual(
    new TokenizationError('invalid_response'),
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockResolvedValueOnce(response({ publicKey: pem }))
  fetchMock.mockResolvedValueOnce(response({ token: 'bad' }, 201))
  await expect(tokenizeCard(card, key, signal)).rejects.toEqual(
    new TokenizationError('invalid_response'),
  )
})

test('maps bridge failure safely and does not post after abort', async () => {
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockResolvedValueOnce(response({ diagnostic: card.number }, 503))
  await expect(tokenizeCard(card, key, signal)).rejects.toEqual(
    new TokenizationError('unavailable'),
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response({ publicKey: pem }))
  jest.mocked(importSPKI).mockImplementationOnce(async () => {
    controller.abort()
    return {} as never
  })
  await expect(tokenizeCard(card, key, controller.signal)).rejects.toBeDefined()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
