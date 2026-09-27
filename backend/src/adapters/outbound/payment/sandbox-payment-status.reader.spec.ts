import { SandboxPaymentStatusReader } from './sandbox-payment-status.reader';

const config = {
  apiBaseUrl: 'https://sandbox.example.test/v1',
  expectedSandboxHost: 'sandbox.example.test',
  privateKey: 'prv_test_fixture_only',
};
const providerId = 'provider-transaction-1';
const data = {
  id: providerId,
  reference: 'txn_test-reference',
  amount_in_cents: 2_700_000,
  currency: 'COP',
  status: 'APPROVED',
};

function response(
  overrides: Record<string, unknown> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify({ data: { ...data, ...overrides } }), {
    status,
  });
}

describe('SandboxPaymentStatusReader', () => {
  const transport = jest.fn();
  const reader = new SandboxPaymentStatusReader(
    config,
    transport as typeof fetch,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transport.mockResolvedValue(response());
  });

  it('performs a bounded server-only private-key GET and returns validated facts', async () => {
    await expect(reader.getById(providerId)).resolves.toEqual({
      providerTransactionId: providerId,
      reference: data.reference,
      amountCents: data.amount_in_cents,
      currency: 'COP',
      status: 'APPROVED',
    });
    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://sandbox.example.test/v1/transactions/${providerId}`,
    );
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer prv_test_fixture_only',
        Accept: 'application/json',
      },
    });
    expect(init.signal).toBeDefined();
  });

  it('returns unavailable for network failure, non-200, malformed, or conflicting data', async () => {
    const invalid = [
      response({ id: 'another-id' }),
      response({ reference: '' }),
      response({ amount_in_cents: '2700000' }),
      response({ currency: 'USD' }),
      response({ status: 'UNKNOWN' }),
      response({}, 503),
      new Response('not-json', { status: 200 }),
    ];
    for (const item of invalid) {
      transport.mockResolvedValueOnce(item);
      await expect(reader.getById(providerId)).resolves.toBeNull();
    }
    transport.mockRejectedValueOnce(new Error('private transport unavailable'));
    await expect(reader.getById(providerId)).resolves.toBeNull();
  });

  it('rejects unsafe IDs without any transport call and invalid sandbox configuration', async () => {
    await expect(reader.getById('../other')).resolves.toBeNull();
    expect(transport).not.toHaveBeenCalled();
    expect(
      () =>
        new SandboxPaymentStatusReader(
          { ...config, apiBaseUrl: 'https://production.example.test/v1' },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
    expect(
      () =>
        new SandboxPaymentStatusReader(
          { ...config, privateKey: 'prv_prod_fixture_only' },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
  });
});
