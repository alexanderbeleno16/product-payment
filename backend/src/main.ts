import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseConnection } from './adapters/outbound/persistence/database-connection';
import { configureOpenApi } from './openapi';
import { configureSecurityHeaders } from './security-headers';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureSecurityHeaders(app);
  app.enableShutdownHooks();
  await app.get(DatabaseConnection).get();
  configureOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
