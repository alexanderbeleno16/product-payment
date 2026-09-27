import { ApiProperty } from '@nestjs/swagger';

const paymentStatuses = [
  'PENDING',
  'SUBMISSION_UNKNOWN',
  'SUBMISSION_REJECTED',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
] as const;

export class CheckoutQuoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ type: Number, minimum: 1 })
  quantity!: number;

  @ApiProperty({ enum: ['COP'] })
  currency!: string;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  unitPriceCents!: number;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  productAmountCents!: number;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  baseFeeCents!: number;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  deliveryFeeCents!: number;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  totalCents!: number;
}

export class ConsentDocumentResponseDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ format: 'uri' })
  permalink!: string;
}

export class ConsentTermsResponseDto {
  @ApiProperty({ description: 'Public sandbox key for browser tokenization' })
  publicKey!: string;

  @ApiProperty({ type: () => ConsentDocumentResponseDto })
  endUserPolicy!: ConsentDocumentResponseDto;

  @ApiProperty({ type: () => ConsentDocumentResponseDto })
  personalDataAuthorization!: ConsentDocumentResponseDto;
}

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Local transaction reference' })
  reference!: string;

  @ApiProperty({
    enum: paymentStatuses,
    description: 'Local status; 201 never means payment approval',
  })
  status!: string;

  @ApiProperty({ type: () => CheckoutQuoteResponseDto })
  quote!: CheckoutQuoteResponseDto;
}

export class TransactionStatusResponseDto {
  @ApiProperty({ description: 'Local transaction reference' })
  reference!: string;

  @ApiProperty({ enum: paymentStatuses })
  paymentStatus!: string;

  @ApiProperty({ enum: ['NOT_STARTED', 'CREATED', 'STOCK_UNAVAILABLE'] })
  fulfillmentStatus!: string;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ pattern: '^[A-Z]{3}$' })
  currency!: string;

  @ApiProperty({ type: Number, description: 'Integer COP cents' })
  priceCents!: number;

  @ApiProperty({ type: Number, minimum: 0 })
  stock!: number;
}
