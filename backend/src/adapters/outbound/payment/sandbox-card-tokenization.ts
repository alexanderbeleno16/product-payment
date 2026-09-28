export interface CardTokenizationConfig {
  apiBaseUrl: string;
  expectedSandboxHost: string;
  publicKey: string;
  timeoutMs?: number;
}

export class CardTokenizationUnavailable extends Error {
  constructor() {
    super('Card tokenization unavailable');
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Fixed-destination relay. The API sees an opaque JWE, never plaintext card fields. */
export class SandboxCardTokenization {
  private readonly keyUrl: string;
  private readonly tokenUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: CardTokenizationConfig,
    private readonly transport: typeof fetch = fetch,
  ) {
    let base: URL;
    try {
      base = new URL(config.apiBaseUrl);
    } catch {
      throw new Error('Invalid sandbox tokenization configuration');
    }
    const paired =
      (base.hostname.startsWith('sandbox.') &&
        config.publicKey.startsWith('pub_test_')) ||
      (base.hostname.startsWith('api-sandbox.') &&
        config.publicKey.startsWith('pub_stagtest_'));
    if (
      !config.expectedSandboxHost ||
      base.hostname !== config.expectedSandboxHost ||
      base.protocol !== 'https:' ||
      base.port ||
      !paired ||
      base.pathname.replace(/\/$/, '') !== '/v1' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !/^pub_[a-z]+_[A-Za-z0-9_-]+$/.test(config.publicKey)
    ) {
      throw new Error('Invalid sandbox tokenization configuration');
    }
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs < 100 ||
      this.timeoutMs > 30000
    )
      throw new Error('Invalid tokenization timeout');
    this.keyUrl = `${base.origin}/v1/tokens/keys/tokenization`;
    this.tokenUrl = `${base.origin}/v1/tokens/cards`;
  }

  async encryptionKey(): Promise<string> {
    const value = await this.request(this.keyUrl, { method: 'GET' }, 200);
    if (
      !record(value) ||
      !record(value.data) ||
      typeof value.data.publicKey !== 'string'
    )
      throw new CardTokenizationUnavailable();
    return canonicalPublicKey(value.data.publicKey);
  }

  async tokenize(payload: string): Promise<string> {
    // Fail closed on arbitrary relay traffic before touching the remote service.
    const parts = payload.split('.');
    if (
      payload.length > 4096 ||
      parts.length !== 5 ||
      parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    )
      throw new CardTokenizationUnavailable();
    try {
      const header: unknown = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      );
      if (
        !record(header) ||
        header.alg !== 'RSA-OAEP-256' ||
        header.enc !== 'A256GCM' ||
        Object.keys(header).some((key) => key !== 'alg' && key !== 'enc')
      )
        throw new Error('Invalid JWE header');
    } catch {
      throw new CardTokenizationUnavailable();
    }
    const value = await this.request(
      this.tokenUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      },
      201,
    );
    if (
      !record(value) ||
      value.status !== 'CREATED' ||
      !record(value.data) ||
      typeof value.data.id !== 'string' ||
      !/^tok_[A-Za-z0-9_-]{1,252}$/.test(value.data.id)
    )
      throw new CardTokenizationUnavailable();
    return value.data.id;
  }

  private async request(
    url: string,
    init: RequestInit,
    expectedStatus: number,
  ): Promise<unknown> {
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${this.config.publicKey}`);
      headers.set('Accept', 'application/json');
      const response = await this.transport(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      if (response.status !== expectedStatus)
        throw new CardTokenizationUnavailable();
      return (await response.json()) as unknown;
    } catch {
      throw new CardTokenizationUnavailable();
    }
  }
}

function canonicalPublicKey(value: string): string {
  if (value.length > 4096) throw new CardTokenizationUnavailable();
  const match =
    /^-----BEGIN PUBLIC KEY-----[ \r\n]*([A-Za-z0-9+/= \r\n]+?)[ \r\n]*-----END PUBLIC KEY-----$/.exec(
      value,
    );
  if (!match) throw new CardTokenizationUnavailable();
  const base64 = match[1].replace(/[ \r\n]/g, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    ) ||
    base64.length < 8 ||
    base64.length > 4000
  )
    throw new CardTokenizationUnavailable();
  const lines = base64.match(/.{1,64}/g);
  if (!lines) throw new CardTokenizationUnavailable();
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}
