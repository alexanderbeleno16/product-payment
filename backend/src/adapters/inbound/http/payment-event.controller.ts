import {
  Body,
  ConflictException,
  Controller,
  Header,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReceivePaymentEvent } from '../../../application/receive-payment-event';
import { PaymentEventDto } from './payment-event.dto';
import { PaymentEventVerifier } from './payment-event.verifier';

@ApiTags('Payment events')
@Controller('payment/events')
export class PaymentEventController {
  constructor(
    private readonly verifier: PaymentEventVerifier,
    private readonly receivePaymentEvent: ReceivePaymentEvent,
  ) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Accept a signed test-environment transaction update after durable handling',
  })
  @ApiBody({ type: PaymentEventDto })
  @ApiResponse({
    status: 200,
    description: 'Verified result handled or safely replayed',
  })
  @ApiResponse({ status: 400, description: 'Malformed or unsupported event' })
  @ApiResponse({ status: 401, description: 'Invalid event checksum' })
  @ApiResponse({ status: 404, description: 'No matching local checkout' })
  @ApiResponse({
    status: 409,
    description: 'Event conflicts with local transaction',
  })
  @ApiResponse({
    status: 503,
    description: 'Authoritative provider status unavailable',
  })
  async receive(
    @Body() event: PaymentEventDto,
    @Headers('x-event-checksum') headerChecksum?: string,
  ): Promise<{ accepted: true }> {
    const signed = this.verifier.verify(event, headerChecksum);
    if (!signed.ok) throw new UnauthorizedException('Invalid payment event');

    const result = await this.receivePaymentEvent.execute(
      signed.providerTransactionId,
    );
    if (result.ok) return { accepted: true };
    switch (result.reason) {
      case 'STATUS_UNAVAILABLE':
        throw new ServiceUnavailableException(
          'Payment status temporarily unavailable',
        );
      case 'NOT_FOUND':
        throw new NotFoundException('Checkout not found');
      case 'MISMATCH':
      case 'TERMINAL_CONFLICT':
      case 'NOT_SUBMITTED':
        throw new ConflictException('Payment event conflicts with checkout');
    }
  }
}
