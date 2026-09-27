import type { CheckoutInput, CheckoutTransaction } from './checkout';
import type { CheckoutStore, NewPendingCheckout } from './checkout-store.port';
import type { PaymentGateway, PaymentSubmissionOutcome } from './payment-gateway.port';
import type { ProductReader } from './product-reader.port';
import { StartCheckout } from './start-checkout';
import { InitiatePayment } from './initiate-payment';

const input: CheckoutInput = {
  idempotencyKey: 'cf2cdd86-05ea-4c7c-adeb-812927f37873',
  productId: '8a52ea31-08d9-4f52-a604-00e56143dce0',
  quantity: 1,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
};
const credentials = {
  cardToken: 'card-token-transient',
  acceptanceToken: 'terms-token-transient',
  personalDataToken: 'privacy-token-transient',
};

describe('InitiatePayment', () => {
  let saved: CheckoutTransaction | null;
  let claimed: boolean;
  const findById = jest.fn();
  const findByIdempotencyKey = jest.fn();
  const createPending = jest.fn();
  const claimSubmission = jest.fn();
  const recordSubmissionOutcome = jest.fn();
  const submit = jest.fn();

  const products: ProductReader = { findById };
  const store: CheckoutStore = {
    findByIdempotencyKey,
    createPending,
    claimSubmission,
    recordSubmissionOutcome,
  };
  const gateway: PaymentGateway = { submit };
  const initiate = new InitiatePayment(
    new StartCheckout(products, store),
    store,
    gateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    saved = null;
    claimed = false;
    findById.mockResolvedValue({
      id: input.productId,
      name: 'Demo product',
      description: 'Demo',
      currency: 'COP',
      priceCents: 1_000_000,
      stock: 2,
    });
    findByIdempotencyKey.mockImplementation(async () => saved);
    createPending.mockImplementation(async (command: NewPendingCheckout) => {
      saved = {
        ...command.quote,
        id: command.id,
        reference: command.reference,
        customerId: '99fa3ee4-49c8-47c6-a96b-ed89241fa516',
        idempotencyKey: command.input.idempotencyKey,
        requestFingerprint: command.requestFingerprint,
        status: 'PENDING',
        submissionStartedAt: null,
        providerTransactionId: null,
        createdAt: new Date('2026-09-26T00:00:00Z'),
      };
      return saved;
    });
    claimSubmission.mockImplementation(async () => {
      if (claimed) return false;
      claimed = true;
      saved = {
        ...saved!,
        status: 'SUBMISSION_UNKNOWN',
        submissionStartedAt: new Date(),
      };
      return true;
    });
    recordSubmissionOutcome.mockImplementation(
      async (_reference: string, outcome: PaymentSubmissionOutcome) => {
        saved = {
          ...saved!,
          status:
            outcome.kind === 'UNKNOWN'
              ? 'SUBMISSION_UNKNOWN'
              : outcome.kind === 'REJECTED'
                ? 'SUBMISSION_REJECTED'
                : 'PENDING',
          providerTransactionId:
            outcome.kind === 'ACCEPTED' ? outcome.providerTransactionId : null,
        };
        return saved;
      },
    );
    submit.mockResolvedValue({
      kind: 'ACCEPTED',
      providerTransactionId: 'sandbox-transaction-123',
    });
  });

  it('rejects missing transient credentials before creating a PENDING row', async () => {
    expect(
      await initiate.execute(input, { ...credentials, personalDataToken: '' }),
    ).toEqual({ ok: false, reason: 'INVALID_INPUT' });
    expect(createPending).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('persists PENDING before one submission and replays without resubmitting', async () => {
    const first = await initiate.execute(input, credentials);
    expect(first).toMatchObject({
      ok: true,
      value: {
        status: 'PENDING',
        providerTransactionId: 'sandbox-transaction-123',
      },
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: expect.stringMatching(/^txn_/),
        amountCents: 1_700_000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
      }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await initiate.execute(input, credentials)).toEqual(first);
    expect(createPending).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('preserves an unknown outcome and never retries the same claim', async () => {
    submit.mockRejectedValueOnce(new Error('Connection ended after send'));
    const first = await initiate.execute(input, credentials);
    expect(first).toMatchObject({
      ok: true,
      value: { status: 'SUBMISSION_UNKNOWN', providerTransactionId: null },
    });
    expect(await initiate.execute(input, credentials)).toEqual(first);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('records definitive rejection without treating it as a paid checkout', async () => {
    submit.mockResolvedValueOnce({ kind: 'REJECTED' });
    const result = await initiate.execute(input, credentials);
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'SUBMISSION_REJECTED', providerTransactionId: null },
    });
    expect(recordSubmissionOutcome).toHaveBeenCalledWith(
      expect.any(String),
      { kind: 'REJECTED' },
    );
  });
});
