import { Transform, Type } from 'class-transformer';
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
  @IsUUID('4')
  productId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[0-9]+$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  addressLine!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;
}

export class CreateCheckoutDto {
  @IsUUID('4')
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  installments!: number;

  @IsEmail()
  @MaxLength(254)
  customerEmail!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  cardToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  acceptanceToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  personalDataToken!: string;

  @IsBoolean()
  @Equals(true)
  acceptsEndUserPolicy!: boolean;

  @IsBoolean()
  @Equals(true)
  acceptsPersonalDataAuthorization!: boolean;
}

export class TransactionReferenceDto {
  @Matches(/^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  reference!: string;
}
