import type { VerifiedPaymentSnapshot } from '../../../application/finalize-verified-payment';
import type { PaymentStatusReader } from '../../../application/payment-status-reader.port';

export interface SandboxStatusConfig {
  readonly apiBaseUrl: string;
  readonly expectedSandboxHost: string;
  readonly privateKey: string;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPaymentStatus(
  value: unknown,
): value is VerifiedPaymentSnapshot['status'] {
  return (
    value === 'PENDING' ||
    value === 'APPROVED' ||
    value === 'DECLINED' ||
    value === 'VOIDED' ||
    value === 'ERROR'
  );
}

function snapshotFromResponse(
  payload: unknown,
  expectedId: string,
): VerifiedPaymentSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const transaction = payload.data;
  if (
    transaction.id !== expectedId ||
    typeof transaction.reference !== 'string' ||
    transaction.reference.length === 0 ||
    transaction.reference.length > 64 ||
    typeof transaction.amount_in_cents !== 'number' ||
    !Number.isSafeInteger(transaction.amount_in_cents) ||
    transaction.amount_in_cents <= 0 ||
    transaction.currency !== 'COP' ||
    !isPaymentStatus(transaction.status)
  ) {
    return null;
  }
  return {
    providerTransactionId: expectedId,
    reference: transaction.reference,
    amountCents: transaction.amount_in_cents,
    currency: 'COP',
    status: transaction.status,
  };
}

export class SandboxPaymentStatusReader implements PaymentStatusReader {
  private readonly transactionUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: SandboxStatusConfig,
    private readonly transport: typeof fetch = fetch,
  ) {
    const base = new URL(config.apiBaseUrl);
    const officialSandbox = base.hostname.startsWith('sandbox.');
    const uatSandbox = base.hostname.startsWith('api-sandbox.');
    if (
      base.protocol !== 'https:' ||
      base.hostname !== config.expectedSandboxHost ||
      base.port !== '' ||
      base.pathname.replace(/\/$/, '') !== '/v1' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !(
        (officialSandbox && config.privateKey.startsWith('prv_test_')) ||
        (uatSandbox && config.privateKey.startsWith('prv_stagtest_'))
      )
    ) {
      throw new Error('Invalid sandbox payment configuration');
    }
    this.timeoutMs = config.timeoutMs ?? 8000;
    if (
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs < 100 ||
      this.timeoutMs > 30000
    ) {
      throw new Error('Invalid payment timeout');
    }
    this.transactionUrl = `${base.origin}/v1/transactions`;
  }

  async getById(
    providerTransactionId: string,
  ): Promise<VerifiedPaymentSnapshot | null> {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(providerTransactionId)) return null;
    try {
      const response = await this.transport(
        `${this.transactionUrl}/${encodeURIComponent(providerTransactionId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.privateKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'error',
        },
      );
      if (response.status !== 200) return null;
      const payload: unknown = await response.json();
      return snapshotFromResponse(payload, providerTransactionId);
    } catch {
      return null;
    }
  }
}
