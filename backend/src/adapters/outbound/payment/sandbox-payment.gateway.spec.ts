import { createHash } from 'node:crypto';
import type { PaymentSubmission } from '../../../application/payment-gateway.port';
import { SandboxPaymentGateway } from './sandbox-payment.gateway';

const config = {
  apiBaseUrl: 'https://sandbox.example.test/v1',
  privateKey: 'prv_test_fixture_only',
  integritySecret: 'test_integrity_fixture_only',
};
const submission: PaymentSubmission = {
  reference: 'txn_test-reference',
  amountCents: 1_700_000,
  currency: 'COP',
  customerEmail: 'buyer@example.com',
  cardToken: 'transient-card-token',
  acceptanceToken: 'transient-terms-token',
  personalDataToken: 'transient-privacy-token',
};

function pendingResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      data: {
        id: 'provider-transaction-1',
        reference: submission.reference,
        amount_in_cents: submission.amountCents,
        currency: 'COP',
        status: 'PENDING',
        ...overrides,
      },
    }),
    { status: 201 },
  );
}

describe('SandboxPaymentGateway', () => {
  const transport = jest.fn();
  const gateway = new SandboxPaymentGateway(
    config,
    transport as typeof fetch,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transport.mockResolvedValue(pendingResponse());
  });

  it('signs the stored server amount and reference and sends both acceptance tokens', async () => {
    expect(await gateway.submit(submission)).toEqual({
      kind: 'ACCEPTED',
      providerTransactionId: 'provider-transaction-1',
    });
    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.example.test/v1/transactions');
    expect(init.redirect).toBe('error');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer prv_test_fixture_only' }),
    );
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      reference: submission.reference,
      amount_in_cents: submission.amountCents,
      currency: 'COP',
      acceptance_token: submission.acceptanceToken,
      accept_personal_auth: submission.personalDataToken,
      payment_method_type: 'CARD',
      payment_method: { type: 'CARD', token: submission.cardToken, installments: 1 },
    });
    expect(sent.signature).toBe(
      createHash('sha256')
        .update(
          `${submission.reference}${submission.amountCents}COP${config.integritySecret}`,
        )
        .digest('hex'),
    );
  });

  it('does not accept a mismatched amount, reference, currency, or terminal status', async () => {
    for (const override of [
      { amount_in_cents: 1 },
      { reference: 'another-reference' },
      { currency: 'USD' },
      { status: 'APPROVED' },
    ]) {
      transport.mockResolvedValueOnce(pendingResponse(override));
      expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
    }
  });

  it('treats every validation response as unknown because a reference conflict may hide a prior charge', async () => {
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { type: 'INPUT_VALIDATION_ERROR', messages: { currency: ['invalid'] } },
        }),
        { status: 422 },
      ),
    );
    expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { type: 'INPUT_VALIDATION_ERROR', messages: { reference: ['used'] } },
        }),
        { status: 422 },
      ),
    );
    expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
  });

  it('treats timeout, server error, and malformed success as unknown', async () => {
    transport.mockRejectedValueOnce(new Error('network lost'));
    expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
    transport.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
    transport.mockResolvedValueOnce(new Response('not-json', { status: 201 }));
    expect(await gateway.submit(submission)).toEqual({ kind: 'UNKNOWN' });
  });

  it('rejects production-like or malformed configuration before transport is available', () => {
    expect(
      () =>
        new SandboxPaymentGateway(
          { ...config, apiBaseUrl: 'https://production.example.test/v1' },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
    expect(
      () =>
        new SandboxPaymentGateway(
          { ...config, privateKey: 'prv_prod_fixture_only' },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
  });

  it('accepts a UAT sandbox with matching staging keys and rejects crossed key families', async () => {
    const uat = new SandboxPaymentGateway(
      {
        apiBaseUrl: 'https://api-sandbox.example.test/v1',
        privateKey: 'prv_stagtest_fixture_only',
        integritySecret: 'stagtest_integrity_fixture_only',
      },
      transport as typeof fetch,
    );
    expect(await uat.submit(submission)).toEqual({
      kind: 'ACCEPTED',
      providerTransactionId: 'provider-transaction-1',
    });
    expect(transport.mock.calls[0][0]).toBe(
      'https://api-sandbox.example.test/v1/transactions',
    );
    expect(
      () =>
        new SandboxPaymentGateway(
          {
            apiBaseUrl: 'https://api-sandbox.example.test/v1',
            privateKey: config.privateKey,
            integritySecret: 'stagtest_integrity_fixture_only',
          },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
    expect(
      () =>
        new SandboxPaymentGateway(
          {
            ...config,
            privateKey: 'prv_stagtest_fixture_only',
          },
          transport as typeof fetch,
        ),
    ).toThrow('Invalid sandbox payment configuration');
  });
});
