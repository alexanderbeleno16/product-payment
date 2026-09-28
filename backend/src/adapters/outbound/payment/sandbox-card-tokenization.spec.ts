import {
  SandboxCardTokenization,
  CardTokenizationUnavailable,
} from './sandbox-card-tokenization';

const config = {
  apiBaseUrl: 'https://api-sandbox.example.com/v1',
  expectedSandboxHost: 'api-sandbox.example.com',
  publicKey: 'pub_stagtest_fixture',
};
const header = Buffer.from(
  JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' }),
).toString('base64url');
const jwe = `${header}.encrypted.key.ciphertext.tag`;
const response = (body: unknown, status = 200) =>
  ({ status, json: async () => body }) as Response;

test('uses fixed HTTPS paths, public-key auth, no redirect, and narrow results', async () => {
  const transport = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      response({
        data: {
          publicKey:
            '-----BEGIN PUBLIC KEY-----\nZmFrZQ==\n-----END PUBLIC KEY-----',
        },
      }),
    )
    .mockResolvedValueOnce(
      response(
        { status: 'CREATED', data: { id: 'tok_fixture', private: 'ignored' } },
        201,
      ),
    );
  const adapter = new SandboxCardTokenization(config, transport);
  await expect(adapter.encryptionKey()).resolves.toContain('BEGIN PUBLIC KEY');
  await expect(adapter.tokenize(jwe)).resolves.toBe('tok_fixture');
  expect(transport.mock.calls.map(([url]) => url)).toEqual([
    'https://api-sandbox.example.com/v1/tokens/keys/tokenization',
    'https://api-sandbox.example.com/v1/tokens/cards',
  ]);
  expect(transport.mock.calls[1][1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      body: JSON.stringify({ payload: jwe }),
    }),
  );
  const headers = new Headers(transport.mock.calls[1][1]?.headers);
  expect(headers.get('Authorization')).toBe(`Bearer ${config.publicKey}`);
});

test('normalizes a single-line public PEM with spaces to browser-compatible PEM', async () => {
  const transport = jest
    .fn<typeof fetch>()
    .mockResolvedValue(
      response({
        data: {
          publicKey:
            '-----BEGIN PUBLIC KEY----- ZmFr ZQ== -----END PUBLIC KEY-----',
        },
      }),
    );
  const adapter = new SandboxCardTokenization(config, transport);
  await expect(adapter.encryptionKey()).resolves.toBe(
    '-----BEGIN PUBLIC KEY-----\nZmFrZQ==\n-----END PUBLIC KEY-----',
  );
});

test('rejects malformed, oversized, or non-base64 public PEM', async () => {
  const transport = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      response({
        data: {
          publicKey:
            '-----BEGIN PRIVATE KEY----- ZmFrZQ== -----END PRIVATE KEY-----',
        },
      }),
    )
    .mockResolvedValueOnce(
      response({
        data: {
          publicKey:
            '-----BEGIN PUBLIC KEY----- ZmFr$Q== -----END PUBLIC KEY-----',
        },
      }),
    )
    .mockResolvedValueOnce(
      response({
        data: {
          publicKey: `-----BEGIN PUBLIC KEY----- ${'A'.repeat(4096)} -----END PUBLIC KEY-----`,
        },
      }),
    );
  const adapter = new SandboxCardTokenization(config, transport);
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(adapter.encryptionKey()).rejects.toBeInstanceOf(
      CardTokenizationUnavailable,
    );
  }
});

test('rejects host/key mismatch and unsafe origin before transport', () => {
  for (const override of [
    { apiBaseUrl: 'http://api-sandbox.example.com/v1' },
    { apiBaseUrl: 'https://api-sandbox.attacker.example/v1' },
    { publicKey: 'pub_test_fixture' },
    { apiBaseUrl: 'https://api-sandbox.example.com/v1?next=evil' },
  ])
    expect(
      () => new SandboxCardTokenization({ ...config, ...override }),
    ).toThrow();
});

test('rejects arbitrary or malformed JWE and never calls provider', async () => {
  const transport = jest.fn<typeof fetch>();
  const adapter = new SandboxCardTokenization(config, transport);
  for (const payload of [
    'plaintext-card-data',
    `${Buffer.from(JSON.stringify({ alg: 'none', enc: 'A256GCM' })).toString('base64url')}.encrypted.key.ciphertext.tag`,
    `${header}.encrypted.key.ciphertext.tag.extra`,
    'a'.repeat(4097),
  ])
    await expect(adapter.tokenize(payload)).rejects.toBeInstanceOf(
      CardTokenizationUnavailable,
    );
  expect(transport).not.toHaveBeenCalled();
});

test('rejects remote failures and malformed responses without relaying bodies', async () => {
  const transport = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response({ diagnostic: 'secret' }, 503))
    .mockResolvedValueOnce(response({ data: { publicKey: 'not pem' } }))
    .mockResolvedValueOnce(
      response({ status: 'CREATED', data: { id: 'bad' } }, 201),
    );
  const adapter = new SandboxCardTokenization(config, transport);
  await expect(adapter.encryptionKey()).rejects.toEqual(
    new CardTokenizationUnavailable(),
  );
  await expect(adapter.encryptionKey()).rejects.toEqual(
    new CardTokenizationUnavailable(),
  );
  await expect(adapter.tokenize(jwe)).rejects.toEqual(
    new CardTokenizationUnavailable(),
  );
});
