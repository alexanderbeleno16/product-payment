import { createHash, timingSafeEqual } from 'node:crypto';
import type { PaymentEventDto } from './payment-event.dto';

type VerificationResult =
  | { readonly ok: true; readonly providerTransactionId: string }
  | { readonly ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPaymentStatus(value: unknown): boolean {
  return (
    value === 'PENDING' ||
    value === 'APPROVED' ||
    value === 'DECLINED' ||
    value === 'VOIDED' ||
    value === 'ERROR'
  );
}

function signedValue(
  data: Record<string, unknown>,
  path: string,
): string | null {
  let current: unknown = data;
  for (const part of path.split('.')) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) return null;
    current = current[part];
  }
  if (typeof current === 'string' && current.length <= 4096) return current;
  if (typeof current === 'number' && Number.isFinite(current))
    return String(current);
  if (typeof current === 'boolean') return String(current);
  return null;
}

export class PaymentEventVerifier {
  constructor(private readonly eventsSecret: string) {
    if (!eventsSecret) throw new Error('Missing event verification secret');
  }

  verify(event: PaymentEventDto, headerChecksum?: string): VerificationResult {
    const transaction = event.data.transaction;
    if (!isRecord(transaction)) return { ok: false };
    const id = transaction.id;
    const status = transaction.status;
    if (
      typeof id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,120}$/.test(id) ||
      !isPaymentStatus(status) ||
      typeof transaction.reference !== 'string' ||
      transaction.reference.length === 0 ||
      transaction.reference.length > 64 ||
      typeof transaction.amount_in_cents !== 'number' ||
      !Number.isSafeInteger(transaction.amount_in_cents) ||
      transaction.amount_in_cents <= 0 ||
      transaction.currency !== 'COP'
    ) {
      return { ok: false };
    }
    if (
      !event.signature.properties.includes('transaction.id') ||
      new Set(event.signature.properties).size !==
        event.signature.properties.length
    ) {
      return { ok: false };
    }
    const values = event.signature.properties.map((path) =>
      signedValue(event.data, path),
    );
    if (values.some((value) => value === null)) return { ok: false };

    const supplied = Buffer.from(event.signature.checksum, 'hex');
    const expected = createHash('sha256')
      .update(`${values.join('')}${event.timestamp}${this.eventsSecret}`)
      .digest();
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return { ok: false };
    }
    if (headerChecksum !== undefined) {
      if (!/^[a-fA-F0-9]{64}$/.test(headerChecksum)) return { ok: false };
      const header = Buffer.from(headerChecksum, 'hex');
      if (!timingSafeEqual(header, supplied)) return { ok: false };
    }
    return { ok: true, providerTransactionId: id };
  }
}
