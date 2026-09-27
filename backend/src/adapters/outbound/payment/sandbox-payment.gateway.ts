import { createHash } from 'node:crypto';
import type {
  PaymentGateway,
  PaymentSubmission,
  PaymentSubmissionOutcome,
} from '../../../application/payment-gateway.port';

export interface SandboxPaymentConfig {
  readonly apiBaseUrl: string;
  readonly privateKey: string;
  readonly integritySecret: string;
  readonly timeoutMs?: number;
}

/** Only the outer adapter knows the remote request and response protocol. */
export class SandboxPaymentGateway implements PaymentGateway {
  private readonly transactionUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: SandboxPaymentConfig,
    private readonly transport: typeof fetch = fetch,
  ) {
    const base = new URL(config.apiBaseUrl);
    const officialSandbox = base.hostname.startsWith('sandbox.');
    const uatSandbox = base.hostname.startsWith('api-sandbox.');
    const matchingTestKeys =
      officialSandbox &&
      config.privateKey.startsWith('prv_test_') &&
      config.integritySecret.startsWith('test_integrity_');
    const matchingUatKeys =
      uatSandbox &&
      config.privateKey.startsWith('prv_stagtest_') &&
      config.integritySecret.startsWith('stagtest_integrity_');
    if (
      base.protocol !== 'https:' ||
      (!matchingTestKeys && !matchingUatKeys) ||
      base.pathname.replace(/\/$/, '') !== '/v1' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error('Invalid sandbox payment configuration');
    }
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 30000) {
      throw new Error('Invalid payment timeout');
    }
    this.transactionUrl = `${base.origin}/v1/transactions`;
  }

  async submit(command: PaymentSubmission): Promise<PaymentSubmissionOutcome> {
    const signature = createHash('sha256')
      .update(
        `${command.reference}${command.amountCents}${command.currency}${this.config.integritySecret}`,
      )
      .digest('hex');
    const body = {
      amount_in_cents: command.amountCents,
      currency: command.currency,
      customer_email: command.customerEmail,
      reference: command.reference,
      signature,
      acceptance_token: command.acceptanceToken,
      accept_personal_auth: command.personalDataToken,
      payment_method_type: 'CARD',
      payment_method: {
        type: 'CARD',
        token: command.cardToken,
        installments: 1,
      },
    };

    try {
      const response = await this.transport(this.transactionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.privateKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) {
        return { kind: 'REJECTED' };
      }
      // Even a validation error can report a reference already accepted after
      // an ambiguous transport failure. Without proof of non-submission, stop.
      if (response.status === 422) return { kind: 'UNKNOWN' };
      if (response.status !== 201) return { kind: 'UNKNOWN' };
      const payload: unknown = await response.json();
      const remote = acceptedPending(payload, command);
      return remote
        ? { kind: 'ACCEPTED', providerTransactionId: remote }
        : { kind: 'UNKNOWN' };
    } catch {
      // The request may have reached the provider before a timeout or disconnect.
      return { kind: 'UNKNOWN' };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function acceptedPending(value: unknown, sent: PaymentSubmission): string | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const data = value.data;
  return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 120 &&
    data.reference === sent.reference &&
    data.amount_in_cents === sent.amountCents &&
    data.currency === sent.currency &&
    data.status === 'PENDING'
    ? data.id
    : null;
}
