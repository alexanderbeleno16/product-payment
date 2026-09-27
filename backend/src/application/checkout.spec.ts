import { createHash } from 'node:crypto';
import type { CheckoutInput, CheckoutTransaction } from './checkout';
import {
  BASE_FEE_CENTS,
  DELIVERY_FEE_CENTS,
  MAX_CHECKOUT_TOTAL_CENTS,
  priceCheckout,
} from '../domain/checkout-pricing';
import {
  IdempotencyKeyTaken,
  type CheckoutStore,
  type NewPendingCheckout,
} from './checkout-store.port';
import type { ProductReader } from './product-reader.port';
import { QuoteCheckout } from './quote-checkout';
import { StartCheckout } from './start-checkout';

const productId = '8a52ea31-08d9-4f52-a604-00e56143dce0';
const key = 'e329fb56-706a-4ea4-91b3-5f6df4625dba';
const input: CheckoutInput = {
  idempotencyKey: key,
  productId,
  quantity: 2,
  installments: 1,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
};
const product = {
  id: productId,
  name: 'Headphones',
  description: 'Wireless',
  currency: 'COP',
  priceCents: 12_990_000,
  stock: 5,
};

describe('checkout application', () => {
  const findById = jest.fn();
  const findByIdempotencyKey = jest.fn();
  const createPending = jest.fn();
  const claimSubmission = jest.fn();
  const recordSubmissionOutcome = jest.fn();
  const reader: ProductReader = { findById };
  const store: CheckoutStore = {
    findByIdempotencyKey,
    createPending,
    claimSubmission,
    recordSubmissionOutcome,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockResolvedValue(product);
    findByIdempotencyKey.mockResolvedValue(null);
    createPending.mockImplementation(
      async (command: NewPendingCheckout): Promise<CheckoutTransaction> => ({
        ...command.quote,
        id: command.id,
        reference: command.reference,
        customerId: '9ec52024-65f6-427b-a2ad-a5d09699a817',
        idempotencyKey: command.input.idempotencyKey,
        requestFingerprint: command.requestFingerprint,
        status: 'PENDING',
        fulfillmentStatus: 'NOT_STARTED',
        submissionStartedAt: null,
        providerTransactionId: null,
        createdAt: new Date('2026-09-26T00:00:00Z'),
      }),
    );
  });

  it('prices a quantity entirely from the server product and demo fees', async () => {
    const result = await new QuoteCheckout(reader).execute(productId, 2);
    expect(result).toEqual({
      ok: true,
      value: {
        productId,
        quantity: 2,
        currency: 'COP',
        unitPriceCents: product.priceCents,
        productAmountCents: 2 * product.priceCents,
        baseFeeCents: BASE_FEE_CENTS,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents:
          2 * product.priceCents + BASE_FEE_CENTS + DELIVERY_FEE_CENTS,
      },
    });
  });

  it('rejects invalid quantity, insufficient stock, unsupported currency, and amounts above the demo cap', () => {
    expect(priceCheckout(product, 0)).toMatchObject({
      ok: false,
      reason: 'INVALID_INPUT',
    });
    expect(priceCheckout(product, 6)).toMatchObject({
      ok: false,
      reason: 'INSUFFICIENT_STOCK',
    });
    expect(priceCheckout({ ...product, currency: 'USD' }, 1)).toMatchObject({
      ok: false,
      reason: 'UNSUPPORTED_CURRENCY',
    });
    expect(
      priceCheckout(
        {
          ...product,
          priceCents:
            MAX_CHECKOUT_TOTAL_CENTS - BASE_FEE_CENTS - DELIVERY_FEE_CENTS,
        },
        1,
      ),
    ).toMatchObject({ ok: true });
    expect(
      priceCheckout(
        {
          ...product,
          priceCents:
            MAX_CHECKOUT_TOTAL_CENTS - BASE_FEE_CENTS - DELIVERY_FEE_CENTS + 1,
        },
        1,
      ),
    ).toMatchObject({ ok: false, reason: 'INVALID_INPUT' });
  });

  it('rejects malformed product IDs before invoking the product reader', async () => {
    const quote = new QuoteCheckout(reader);
    await expect(quote.execute('not-a-uuid', 1)).resolves.toEqual({
      ok: false,
      reason: 'INVALID_INPUT',
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('reports an unavailable quote product without inventing a price', async () => {
    findById.mockResolvedValueOnce(null);
    await expect(
      new QuoteCheckout(reader).execute(productId, 1),
    ).resolves.toEqual({ ok: false, reason: 'PRODUCT_NOT_FOUND' });
    expect(findById).toHaveBeenCalledWith(productId);
    expect(createPending).not.toHaveBeenCalled();
  });

  it('persists one pending transaction with a canonical business fingerprint', async () => {
    const result = await new StartCheckout(reader, store).execute(input);
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'PENDING', idempotencyKey: key },
    });
    expect(createPending).toHaveBeenCalledTimes(1);
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        input,
        quote: expect.objectContaining({ totalCents: 26_680_000 }),
        requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        reference: expect.stringMatching(/^txn_[0-9a-f-]{36}$/),
      }),
    );
    const legacyFingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          productId,
          2,
          'buyer@example.com',
          'Ada Lovelace',
          '123 Main Street',
          'Bogota',
        ]),
      )
      .digest('hex');
    expect(createPending.mock.calls[0][0].requestFingerprint).toBe(
      legacyFingerprint,
    );
    expect(claimSubmission).not.toHaveBeenCalled();
  });

  it('replays the original snapshot without a second price or stock lookup', async () => {
    const useCase = new StartCheckout(reader, store);
    const first = await useCase.execute(input);
    if (!first.ok) throw new Error('Expected pending checkout');
    findById.mockClear();
    createPending.mockClear();
    findByIdempotencyKey.mockResolvedValue(first.value);

    const replay = await useCase.execute({
      ...input,
      customerEmail: ' BUYER@example.com ',
    });
    expect(replay).toEqual(first);
    expect(findById).not.toHaveBeenCalled();
    expect(createPending).not.toHaveBeenCalled();
  });

  it('rejects same key with changed delivery, quantity, or installments', async () => {
    const useCase = new StartCheckout(reader, store);
    const first = await useCase.execute(input);
    if (!first.ok) throw new Error('Expected pending checkout');
    findByIdempotencyKey.mockResolvedValue(first.value);
    expect(await useCase.execute({ ...input, quantity: 1 })).toEqual({
      ok: false,
      reason: 'IDEMPOTENCY_CONFLICT',
    });
    expect(
      await useCase.execute({
        ...input,
        delivery: { ...input.delivery, city: 'Medellin' },
      }),
    ).toEqual({ ok: false, reason: 'IDEMPOTENCY_CONFLICT' });
    expect(await useCase.execute({ ...input, installments: 2 })).toEqual({
      ok: false,
      reason: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('resolves a concurrent unique-key loser to the winning snapshot', async () => {
    const useCase = new StartCheckout(reader, store);
    const first = await useCase.execute(input);
    if (!first.ok) throw new Error('Expected pending checkout');
    findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(first.value);
    createPending.mockRejectedValueOnce(new IdempotencyKeyTaken());
    expect(await useCase.execute(input)).toEqual(first);
  });

  it('does not create a transaction for missing product or invalid buyer data', async () => {
    findById.mockResolvedValue(null);
    expect(await new StartCheckout(reader, store).execute(input)).toEqual({
      ok: false,
      reason: 'PRODUCT_NOT_FOUND',
    });
    expect(
      await new StartCheckout(reader, store).execute({
        ...input,
        customerEmail: 'not-email',
      }),
    ).toEqual({ ok: false, reason: 'INVALID_INPUT' });
    expect(createPending).not.toHaveBeenCalled();
  });

  it('rejects malformed direct-use values before canonicalization or persistence', async () => {
    const useCase = new StartCheckout(reader, store);
    const malformed: unknown[] = [
      null,
      [],
      { ...input, idempotencyKey: null },
      { ...input, productId: 42 },
      { ...input, quantity: '2' },
      { ...input, installments: undefined },
      { ...input, customerEmail: {} },
      { ...input, delivery: null },
      { ...input, delivery: [input.delivery] },
      { ...input, delivery: { ...input.delivery, city: 42 } },
      { ...input, delivery: { ...input.delivery, addressLine: ' '.repeat(4) } },
    ];
    for (const raw of malformed) {
      await expect(useCase.execute(raw as CheckoutInput)).resolves.toEqual({
        ok: false,
        reason: 'INVALID_INPUT',
      });
    }
    expect(findByIdempotencyKey).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(createPending).not.toHaveBeenCalled();
  });

  it('does not persist a PENDING transaction when requested quantity exceeds stock', async () => {
    expect(
      await new StartCheckout(reader, store).execute({
        ...input,
        quantity: product.stock + 1,
      }),
    ).toEqual({ ok: false, reason: 'INSUFFICIENT_STOCK' });
    expect(createPending).not.toHaveBeenCalled();
    expect(claimSubmission).not.toHaveBeenCalled();
  });

  it('rejects unsafe or missing installments before persistence', async () => {
    for (const installments of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        await new StartCheckout(reader, store).execute({
          ...input,
          installments,
        }),
      ).toEqual({ ok: false, reason: 'INVALID_INPUT' });
    }
    expect(createPending).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
  });

  it('propagates an unexpected persistence fault instead of treating it as an idempotent replay', async () => {
    const fault = new Error('Database unavailable');
    createPending.mockRejectedValueOnce(fault);

    await expect(new StartCheckout(reader, store).execute(input)).rejects.toBe(
      fault,
    );
    expect(findByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(claimSubmission).not.toHaveBeenCalled();
  });

  it('preserves a unique-key failure when the winning transaction cannot be read', async () => {
    const fault = new IdempotencyKeyTaken();
    createPending.mockRejectedValueOnce(fault);

    await expect(new StartCheckout(reader, store).execute(input)).rejects.toBe(
      fault,
    );
    expect(findByIdempotencyKey).toHaveBeenCalledTimes(2);
    expect(claimSubmission).not.toHaveBeenCalled();
  });
});
