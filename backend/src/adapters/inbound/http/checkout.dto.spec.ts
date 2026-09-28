import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateCheckoutDto,
  QuoteQueryDto,
  TransactionReferenceDto,
} from './checkout.dto';

const productId = '8a52ea31-08d9-4f52-a604-00e56143dce0';
const validBody = {
  productId,
  quantity: 2,
  expectedTotalCents: 2_700_000,
  installments: 3,
  customerEmail: 'buyer@example.com',
  delivery: {
    recipientName: 'Ada Lovelace',
    addressLine: '123 Main Street',
    city: 'Bogota',
  },
  cardToken: 'ephemeral-card-token',
  acceptanceToken: 'ephemeral-policy-token',
  personalDataToken: 'ephemeral-privacy-token',
  acceptsEndUserPolicy: true,
  acceptsPersonalDataAuthorization: true,
};

const pipe = new ValidationPipe({
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  validationError: { target: false, value: false },
});

describe('Checkout transport DTOs', () => {
  it('accepts a complete checkout but does not coerce JSON body strings to numbers', async () => {
    const result = await pipe.transform(validBody, {
      type: 'body',
      metatype: CreateCheckoutDto,
    });
    expect(result).toBeInstanceOf(CreateCheckoutDto);
    expect(result.delivery).toEqual(validBody.delivery);

    await expect(
      pipe.transform(
        { ...validBody, quantity: '2' },
        { type: 'body', metatype: CreateCheckoutDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [{ ...validBody, priceCents: 1 }],
    [{ ...validBody, cardNumber: 'must-not-be-accepted' }],
    [{ ...validBody, delivery: { ...validBody.delivery, extra: 'untrusted' } }],
    [{ ...validBody, delivery: 'not an object' }],
    [{ ...validBody, acceptsEndUserPolicy: false }],
    [{ ...validBody, acceptsPersonalDataAuthorization: false }],
    [{ ...validBody, acceptsEndUserPolicy: 'true' }],
    [{ ...validBody, installments: 0 }],
    [{ ...validBody, installments: 1.5 }],
    [{ ...validBody, expectedTotalCents: undefined }],
    [{ ...validBody, expectedTotalCents: 0 }],
    [{ ...validBody, expectedTotalCents: -1 }],
    [{ ...validBody, expectedTotalCents: 1.5 }],
    [{ ...validBody, expectedTotalCents: '2700000' }],
    [{ ...validBody, expectedTotalCents: Number.MAX_SAFE_INTEGER + 1 }],
  ])(
    'rejects malformed, unknown, or unaccepted checkout data: %j',
    async (input) => {
      await expect(
        pipe.transform(input, { type: 'body', metatype: CreateCheckoutDto }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('accepts only a plain positive integer query quantity', async () => {
    const result = await pipe.transform(
      { productId, quantity: '2' },
      { type: 'query', metatype: QuoteQueryDto },
    );
    expect(result).toMatchObject({ productId, quantity: 2 });

    for (const quantity of ['0', '-1', '1.5', '1e2', '2abc']) {
      await expect(
        pipe.transform(
          { productId, quantity },
          { type: 'query', metatype: QuoteQueryDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rejects malformed transaction references before status lookup', async () => {
    await expect(
      pipe.transform(
        { reference: 'txn_511da8e3-4a22-430a-83f6-e8729df28679' },
        { type: 'param', metatype: TransactionReferenceDto },
      ),
    ).resolves.toBeInstanceOf(TransactionReferenceDto);
    await expect(
      pipe.transform(
        { reference: 'other-reference' },
        { type: 'param', metatype: TransactionReferenceDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
