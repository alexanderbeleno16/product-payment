import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  Equals,
  IsArray,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  MaxLength,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class EventSignatureDto {
  @ApiProperty({
    type: [String],
    example: ['transaction.id', 'transaction.status'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(256, { each: true })
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/, {
    each: true,
  })
  properties!: string[];

  @ApiProperty({ pattern: '^[a-fA-F0-9]{64}$' })
  @Matches(/^[a-fA-F0-9]{64}$/)
  checksum!: string;
}

export class PaymentEventDto {
  @ApiProperty({ enum: ['transaction.updated'] })
  @Equals('transaction.updated')
  event!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiProperty({ enum: ['test'] })
  @Equals('test')
  environment!: string;

  @ApiProperty({ type: () => EventSignatureDto })
  @ValidateNested()
  @Type(() => EventSignatureDto)
  signature!: EventSignatureDto;

  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  timestamp!: number;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  sent_at!: string;
}
