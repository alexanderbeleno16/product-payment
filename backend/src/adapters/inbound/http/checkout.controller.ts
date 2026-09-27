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
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  CheckoutFailure,
  CheckoutInput,
  CheckoutTransaction,
} from '../../../application/checkout';
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
import {
  CheckoutQuoteResponseDto,
  CheckoutResponseDto,
  ConsentTermsResponseDto,
  TransactionStatusResponseDto,
} from './response.dto';

const IdempotencyKey = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): string | string[] | undefined => {
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
      throw new ConflictException(
        'Idempotency key conflicts with the original checkout',
      );
    case 'UNSUPPORTED_CURRENCY':
      throw new UnprocessableEntityException(
        'Product currency is not supported',
      );
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

@ApiTags('Checkout')
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
  @ApiOperation({
    summary: 'Quote one product using server-owned prices and fees',
  })
  @ApiResponse({ status: 200, type: CheckoutQuoteResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid product ID or quantity' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  @ApiResponse({ status: 422, description: 'Unsupported product currency' })
  async quote(@Query() query: QuoteQueryDto): Promise<CheckoutQuote> {
    const result = await this.quoteCheckout.execute(
      query.productId,
      query.quantity,
    );
    if (!result.ok) return rejectCheckout(result.reason);
    return publicQuote(result.value);
  }

  @Get('checkout/consents')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read both current consent documents and the public key',
  })
  @ApiResponse({ status: 200, type: ConsentTermsResponseDto })
  @ApiResponse({
    status: 503,
    description: 'Current consent documents unavailable',
  })
  async consents() {
    try {
      const terms = await this.consentTerms.getCurrent();
      return {
        publicKey: terms.publicKey,
        endUserPolicy: terms.endUserPolicy,
        personalDataAuthorization: terms.personalDataAuthorization,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Consent terms are temporarily unavailable',
      );
    }
  }

  @Post('checkouts')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create or replay a local checkout and initiate payment once',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Buyer-generated UUID v4; reuse only for the same checkout intent',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 201,
    type: CheckoutResponseDto,
    description:
      'Local checkout created or replayed; PENDING is not payment approval',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input, header, or missing explicit consent',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({
    status: 409,
    description: 'Insufficient stock or conflicting idempotency key',
  })
  @ApiResponse({ status: 422, description: 'Unsupported product currency' })
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
  @ApiOperation({
    summary: 'Read narrow local status for the original checkout key',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Original checkout UUID v4',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiParam({ name: 'reference', description: 'Local transaction reference' })
  @ApiResponse({ status: 200, type: TransactionStatusResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid reference or idempotency key',
  })
  @ApiResponse({
    status: 404,
    description: 'Reference and key do not identify the same checkout',
  })
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
