import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { SandboxCardTokenization } from '../../outbound/payment/sandbox-card-tokenization';

export class EncryptedCardDto {
  @ApiProperty({ description: 'Compact JWE encrypted in the browser' })
  @IsString()
  @MaxLength(4096)
  @Matches(
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  )
  payload!: string;
}

@ApiTags('Checkout')
@Controller('checkout')
export class CardTokenizationController {
  constructor(private readonly tokenization: SandboxCardTokenization) {}

  @Get('tokenization-key')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read the public card-encryption key' })
  @ApiResponse({ status: 200, description: 'Public PEM only' })
  @ApiResponse({ status: 503, description: 'Key unavailable' })
  async key(): Promise<{ publicKey: string }> {
    try {
      return { publicKey: await this.tokenization.encryptionKey() };
    } catch {
      throw new ServiceUnavailableException('Card tokenization unavailable');
    }
  }

  @Post('card-tokens')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Relay only a browser-encrypted compact JWE' })
  @ApiResponse({ status: 201, description: 'Opaque card token only' })
  @ApiResponse({ status: 400, description: 'Invalid encrypted payload' })
  @ApiResponse({ status: 503, description: 'Tokenization unavailable' })
  async cardToken(@Body() body: EncryptedCardDto): Promise<{ token: string }> {
    try {
      return { token: await this.tokenization.tokenize(body.payload) };
    } catch {
      throw new ServiceUnavailableException('Card tokenization unavailable');
    }
  }
}
