import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CheckoutFailure, CheckoutInput, CheckoutTransaction } from '../../../application/checkout';
import type { ConsentTermsReader } from '../../../application/consent-terms.port';
import { GetTransactionStatus } from '../../../application/get-transaction-status';
import { InitiatePayment } from '../../../application/initiate-payment';
import { QuoteCheckout } from '../../../application/quote-checkout';
import type { CheckoutQuote } from '../../../domain/checkout';
import { CONSENT_TERMS_READER } from '../../../checkout.tokens';
import {
  CreateCheckoutDto,
  QuoteQueryDto,
  TransactionReferenceDto,
} from './checkout.dto';

const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | string[] | undefined => {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    return request.headers['idempotency-key'];
  },
);

function rejectCheckout(reason: CheckoutFailure): never {
  switch (reason) {
    case 'INVALID_INPUT':
      throw new BadRequestException('Invalid checkout request');
    case 'PRODUCT_NOT_FOUND':
      throw new NotFoundException('Product not found');
    case 'INSUFFICIENT_STOCK':
      throw new ConflictException('Insufficient stock');
    case 'IDEMPOTENCY_CONFLICT':
      throw new ConflictException('Idempotency key conflicts with the original checkout');
    case 'UNSUPPORTED_CURRENCY':
      throw new UnprocessableEntityException('Product currency is not supported');
  }
}

function publicQuote(quote: CheckoutQuote): CheckoutQuote {
  return {
    productId: quote.productId,
    quantity: quote.quantity,
    currency: quote.currency,
    unitPriceCents: quote.unitPriceCents,
    productAmountCents: quote.productAmountCents,
    baseFeeCents: quote.baseFeeCents,
    deliveryFeeCents: quote.deliveryFeeCents,
    totalCents: quote.totalCents,
  };
}

@Controller()
export class CheckoutController {
  constructor(
    private readonly quoteCheckout: QuoteCheckout,
    private readonly initiatePayment: InitiatePayment,
    private readonly getTransactionStatus: GetTransactionStatus,
    @Inject(CONSENT_TERMS_READER)
    private readonly consentTerms: ConsentTermsReader,
  ) {}

  @Get('checkout/quote')
  @Header('Cache-Control', 'no-store')
  async quote(@Query() query: QuoteQueryDto): Promise<CheckoutQuote> {
    const result = await this.quoteCheckout.execute(query.productId, query.quantity);
    if (!result.ok) return rejectCheckout(result.reason);
    return publicQuote(result.value);
  }

  @Get('checkout/consents')
  @Header('Cache-Control', 'no-store')
  async consents() {
    try {
      const terms = await this.consentTerms.getCurrent();
      return {
        publicKey: terms.publicKey,
        endUserPolicy: terms.endUserPolicy,
        personalDataAuthorization: terms.personalDataAuthorization,
      };
    } catch {
      throw new ServiceUnavailableException('Consent terms are temporarily unavailable');
    }
  }

  @Post('checkouts')
  @Header('Cache-Control', 'no-store')
  async create(
    @IdempotencyKey(new ParseUUIDPipe({ version: '4' })) idempotencyKey: string,
    @Body() body: CreateCheckoutDto,
  ) {
    const input: CheckoutInput = {
      idempotencyKey,
      productId: body.productId,
      quantity: body.quantity,
      installments: body.installments,
      customerEmail: body.customerEmail,
      delivery: {
        recipientName: body.delivery.recipientName,
        addressLine: body.delivery.addressLine,
        city: body.delivery.city,
      },
    };
    const result = await this.initiatePayment.execute(
      input,
      {
        cardToken: body.cardToken,
        acceptanceToken: body.acceptanceToken,
        personalDataToken: body.personalDataToken,
      },
      {
        acceptsEndUserPolicy: body.acceptsEndUserPolicy,
        acceptsPersonalDataAuthorization: body.acceptsPersonalDataAuthorization,
      },
    );
    if (!result.ok) return rejectCheckout(result.reason);
    return this.publicCheckout(result.value);
  }

  @Get('transactions/:reference')
  @Header('Cache-Control', 'no-store')
  async status(
    @Param() params: TransactionReferenceDto,
    @IdempotencyKey(new ParseUUIDPipe({ version: '4' })) idempotencyKey: string,
  ) {
    const result = await this.getTransactionStatus.execute(
      params.reference,
      idempotencyKey,
    );
    if (!result.ok) throw new NotFoundException('Transaction not found');
    return result.value;
  }

  private publicCheckout(transaction: CheckoutTransaction) {
    return {
      reference: transaction.reference,
      status: transaction.status,
      quote: publicQuote(transaction),
    };
  }
}
