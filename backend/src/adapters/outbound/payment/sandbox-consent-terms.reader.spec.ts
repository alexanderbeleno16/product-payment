import { SandboxConsentTermsReader } from './sandbox-consent-terms.reader';

const config = {
  apiBaseUrl: 'https://sandbox.example.test/v1',
  expectedSandboxHost: 'sandbox.example.test',
  publicKey: 'pub_test_fixture_only',
};
const merchantInfo = {
  data: {
    presigned_acceptance: {
      acceptance_token: 'terms-token',
      permalink: 'https://documents.example.test/terms.pdf',
      type: 'END_USER_POLICY',
    },
    presigned_personal_data_auth: {
      acceptance_token: 'personal-data-token',
      permalink: 'https://documents.example.test/privacy.pdf',
      type: 'PERSONAL_DATA_AUTH',
    },
  },
};

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

describe('SandboxConsentTermsReader', () => {
  const transport = jest.fn();
  const reader = new SandboxConsentTermsReader(config, transport as typeof fetch);

  beforeEach(() => {
    jest.clearAllMocks();
    transport.mockResolvedValue(reply(merchantInfo));
  });

  it('gets both current consent documents with only the public merchant key', async () => {
    await expect(reader.getCurrent()).resolves.toEqual({
      publicKey: config.publicKey,
      endUserPolicy: {
        token: 'terms-token',
        permalink: 'https://documents.example.test/terms.pdf',
      },
      personalDataAuthorization: {
        token: 'personal-data-token',
        permalink: 'https://documents.example.test/privacy.pdf',
      },
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.example.test/v1/merchants/info');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({
      'x-merchant-public-key': config.publicKey,
      Accept: 'application/json',
    });
    expect(init.body).toBeUndefined();
  });

  it('supports the challenge UAT sandbox only with a matching public-key family', async () => {
    const uat = new SandboxConsentTermsReader(
      {
        apiBaseUrl: 'https://api-sandbox.example.test/v1',
        expectedSandboxHost: 'api-sandbox.example.test',
        publicKey: 'pub_stagtest_fixture_only',
      },
      transport as typeof fetch,
    );
    await expect(uat.getCurrent()).resolves.toMatchObject({
      publicKey: 'pub_stagtest_fixture_only',
    });
    expect(transport.mock.calls[0][0]).toBe('https://api-sandbox.example.test/v1/merchants/info');
    expect(() => new SandboxConsentTermsReader(
      { ...config, apiBaseUrl: 'https://api-sandbox.example.test/v1' },
      transport as typeof fetch,
    )).toThrow('Invalid sandbox consent configuration');
    expect(() => new SandboxConsentTermsReader(
      { ...config, publicKey: 'pub_stagtest_fixture_only' },
      transport as typeof fetch,
    )).toThrow('Invalid sandbox consent configuration');
  });

  it('rejects production, non-HTTPS, malformed, and credential-bearing configuration', () => {
    for (const apiBaseUrl of [
      'https://production.example.test/v1',
      'http://sandbox.example.test/v1',
      'https://user:pass@sandbox.example.test/v1',
      'https://sandbox.example.test/v1?leak=1',
      'https://sandbox.attacker.example/v1',
      'https://sandbox.example.test:8443/v1',
      'not-a-url',
    ]) {
      expect(() => new SandboxConsentTermsReader(
        { ...config, apiBaseUrl },
        transport as typeof fetch,
      )).toThrow('Invalid sandbox consent configuration');
    }
    expect(() => new SandboxConsentTermsReader(
      { ...config, timeoutMs: 60_000 },
      transport as typeof fetch,
    )).toThrow('Invalid consent timeout');
  });

  it('fails closed when a required document or safe permalink is missing', async () => {
    for (const invalidDocument of [
      null,
      { ...merchantInfo.data.presigned_acceptance, acceptance_token: '' },
      { ...merchantInfo.data.presigned_acceptance, permalink: 'http://documents.example.test/terms' },
      { ...merchantInfo.data.presigned_acceptance, permalink: 'javascript:alert(1)' },
      { ...merchantInfo.data.presigned_acceptance, type: 'WRONG_TYPE' },
    ]) {
      transport.mockResolvedValueOnce(reply({
        data: { ...merchantInfo.data, presigned_acceptance: invalidDocument },
      }));
      await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
    }
    transport.mockResolvedValueOnce(reply({ data: {
      ...merchantInfo.data,
      presigned_personal_data_auth: undefined,
    } }));
    await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
  });

  it('does not expose remote body or transport errors on auth, timeout, redirect, and malformed JSON', async () => {
    transport.mockResolvedValueOnce(reply({ secret: 'remote-secret' }, 401));
    await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
    transport.mockRejectedValueOnce(new Error('private transport detail'));
    await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
    transport.mockRejectedValueOnce(new Error('redirect blocked'));
    await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
    transport.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    await expect(reader.getCurrent()).rejects.toThrow('Consent terms are temporarily unavailable');
  });
});
