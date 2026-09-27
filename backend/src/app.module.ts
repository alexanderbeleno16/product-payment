import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './adapters/inbound/http/app.controller';
import { AppService } from './adapters/inbound/http/app.service';
import { SafeExceptionFilter } from './adapters/inbound/http/safe-exception.filter';
import { ProductsModule } from './products.module';
import { CheckoutModule } from './checkout.module';

@Module({
  imports: [ProductsModule, CheckoutModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: SafeExceptionFilter },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          transformOptions: { enableImplicitConversion: false },
          whitelist: true,
          forbidNonWhitelisted: true,
          forbidUnknownValues: true,
          validationError: { target: false, value: false },
        }),
    },
  ],
})
export class AppModule {}
