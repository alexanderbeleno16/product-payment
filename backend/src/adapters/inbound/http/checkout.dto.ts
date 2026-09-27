import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ type: Number, minimum: 1 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientName!: string;

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  addressLine!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;
}

export class CreateCheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  installments!: number;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  customerEmail!: string;

  @ApiProperty({ type: () => DeliveryDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @ApiProperty({
    description: 'Transient card token, never raw card data',
    format: 'password',
    maxLength: 256,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  cardToken!: string;

  @ApiProperty({ format: 'password', maxLength: 1024 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  acceptanceToken!: string;

  @ApiProperty({ format: 'password', maxLength: 1024 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  personalDataToken!: string;

  @ApiProperty({
    type: Boolean,
    enum: [true],
    description: 'Explicit acceptance of the end-user policy',
  })
  @IsBoolean()
  @Equals(true)
  acceptsEndUserPolicy!: boolean;

  @ApiProperty({
    type: Boolean,
    enum: [true],
    description: 'Explicit authorization for personal data handling',
  })
  @IsBoolean()
  @Equals(true)
  acceptsPersonalDataAuthorization!: boolean;
}

export class TransactionReferenceDto {
  @ApiProperty({
    pattern:
      '^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  })
  @Matches(
    /^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  reference!: string;
}
