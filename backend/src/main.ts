import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseConnection } from './infrastructure/persistence/database-connection';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.get(DatabaseConnection).get();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
