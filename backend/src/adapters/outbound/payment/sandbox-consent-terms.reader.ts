import type {
  ConsentDocument,
  ConsentTerms,
  ConsentTermsReader,
} from '../../../application/consent-terms.port';
import { ConsentTermsUnavailable } from '../../../application/consent-terms.port';

export interface SandboxConsentTermsConfig {
  readonly apiBaseUrl: string;
  readonly expectedSandboxHost: string;
  readonly publicKey: string;
  readonly timeoutMs?: number;
}

/** Translates the sandbox merchant-info protocol into two current consent documents. */
export class SandboxConsentTermsReader implements ConsentTermsReader {
  private readonly infoUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: SandboxConsentTermsConfig,
    private readonly transport: typeof fetch = fetch,
  ) {
    let base: URL;
    try {
      base = new URL(config.apiBaseUrl);
    } catch {
      throw new Error('Invalid sandbox consent configuration');
    }
    const officialSandbox =
      base.hostname.startsWith('sandbox.') && config.publicKey.startsWith('pub_test_');
    const uatSandbox =
      base.hostname.startsWith('api-sandbox.') && config.publicKey.startsWith('pub_stagtest_');
    if (
      base.protocol !== 'https:' ||
      base.hostname !== config.expectedSandboxHost ||
      base.port !== '' ||
      (!officialSandbox && !uatSandbox) ||
      base.pathname.replace(/\/$/, '') !== '/v1' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error('Invalid sandbox consent configuration');
    }
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 30000) {
      throw new Error('Invalid consent timeout');
    }
    this.infoUrl = `${base.origin}/v1/merchants/info`;
  }

  async getCurrent(): Promise<ConsentTerms> {
    let response: Response;
    try {
      response = await this.transport(this.infoUrl, {
        method: 'GET',
        headers: {
          'x-merchant-public-key': this.config.publicKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      throw new ConsentTermsUnavailable(
        name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network',
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new ConsentTermsUnavailable('auth');
    if (response.status !== 200)
      throw new ConsentTermsUnavailable(response.status >= 500 ? 'network' : 'invalid_response');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ConsentTermsUnavailable('invalid_response');
    }
    if (!isRecord(payload) || !isRecord(payload.data))
      throw new ConsentTermsUnavailable('invalid_response');
    const endUserPolicy = documentFrom(payload.data.presigned_acceptance, 'END_USER_POLICY');
    const personalDataAuthorization = documentFrom(
      payload.data.presigned_personal_data_auth,
      'PERSONAL_DATA_AUTH',
    );
    if (!endUserPolicy || !personalDataAuthorization)
      throw new ConsentTermsUnavailable('invalid_response');
    return {
      publicKey: this.config.publicKey,
      endUserPolicy,
      personalDataAuthorization,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function documentFrom(value: unknown, type: string): ConsentDocument | null {
  if (
    !isRecord(value) ||
    value.type !== type ||
    typeof value.acceptance_token !== 'string' ||
    !value.acceptance_token.trim() ||
    typeof value.permalink !== 'string'
  ) {
    return null;
  }
  try {
    const url = new URL(value.permalink);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch {
    return null;
  }
  return { token: value.acceptance_token, permalink: value.permalink };
}
