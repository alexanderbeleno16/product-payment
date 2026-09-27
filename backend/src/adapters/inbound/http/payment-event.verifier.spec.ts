import { createHash } from 'node:crypto';
import type { PaymentEventDto } from './payment-event.dto';
import { PaymentEventVerifier } from './payment-event.verifier';

const secret = 'test_events_fixture_only';
const verifier = new PaymentEventVerifier(secret);
const baseTransaction = {
  id: 'provider-transaction-1',
  status: 'APPROVED',
  amount_in_cents: 2_700_000,
  reference: 'txn_test-reference',
  currency: 'COP',
};

type FixtureEvent = PaymentEventDto & {
  data: { transaction: Record<string, unknown> };
};

function event(
  properties: string[],
  overrides: Partial<typeof baseTransaction> = {},
): FixtureEvent {
  const transaction = { ...baseTransaction, ...overrides };
  const values = properties.map((property) => {
    const key = property.slice(
      'transaction.'.length,
    ) as keyof typeof transaction;
    return String(transaction[key]);
  });
  return {
    event: 'transaction.updated',
    environment: 'test',
    data: { transaction },
    signature: {
      properties,
      checksum: createHash('sha256')
        .update(`${values.join('')}1530291411${secret}`)
        .digest('hex'),
    },
    timestamp: 1530291411,
    sent_at: '2026-09-26T00:00:00.000Z',
  } as FixtureEvent;
}

describe('PaymentEventVerifier', () => {
  it('accepts dynamic signed fields in their supplied order and an optional matching header', () => {
    const signed = event([
      'transaction.status',
      'transaction.id',
      'transaction.amount_in_cents',
    ]);
    expect(
      verifier.verify(signed, signed.signature.checksum.toUpperCase()),
    ).toEqual({
      ok: true,
      providerTransactionId: baseTransaction.id,
      signedTerminalStatus: 'APPROVED',
    });
  });

  it('does not treat an unsigned status as a retry hint', () => {
    expect(verifier.verify(event(['transaction.id']))).toEqual({
      ok: true,
      providerTransactionId: baseTransaction.id,
      signedTerminalStatus: null,
    });
  });

  it('rejects tampering, a mismatched header, or an invalid checksum without leaking a secret', () => {
    const signed = event(['transaction.id', 'transaction.status']);
    const tampered = event(['transaction.id', 'transaction.status']);
    tampered.data.transaction.id = 'changed-id';
    expect(verifier.verify(tampered)).toEqual({ ok: false });
    expect(verifier.verify(signed, '0'.repeat(64))).toEqual({ ok: false });
    expect(verifier.verify(signed, 'not-a-digest')).toEqual({ ok: false });
    const badChecksum = event(['transaction.id', 'transaction.status']);
    badChecksum.signature.checksum = '0'.repeat(64);
    expect(verifier.verify(badChecksum)).toEqual({ ok: false });
  });

  it('rejects an unsigned ID, duplicated properties, and missing signed values', () => {
    const unsignedId = event([
      'transaction.status',
      'transaction.amount_in_cents',
    ]);
    expect(verifier.verify(unsignedId)).toEqual({ ok: false });
    const duplicate = event(['transaction.id', 'transaction.id']);
    expect(verifier.verify(duplicate)).toEqual({ ok: false });
    const missing = event(['transaction.id', 'transaction.status']);
    delete missing.data.transaction.status;
    expect(verifier.verify(missing)).toEqual({ ok: false });
  });

  it('rejects malformed IDs and unsupported statuses despite a valid checksum', () => {
    expect(
      verifier.verify(
        event(['transaction.id', 'transaction.status'], { status: 'UNKNOWN' }),
      ),
    ).toEqual({ ok: false });
    expect(
      verifier.verify(event(['transaction.id'], { id: '../other' })),
    ).toEqual({ ok: false });
    expect(
      verifier.verify(
        event(['transaction.id', 'transaction.currency'], { currency: 'USD' }),
      ),
    ).toEqual({ ok: false });
    expect(
      verifier.verify(
        event(['transaction.id', 'transaction.amount_in_cents'], {
          amount_in_cents: -1,
        }),
      ),
    ).toEqual({ ok: false });
  });
});
