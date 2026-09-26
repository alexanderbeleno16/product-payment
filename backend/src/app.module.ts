import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products.module';
import { CheckoutModule } from './checkout.module';

@Module({
  imports: [ProductsModule, CheckoutModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
