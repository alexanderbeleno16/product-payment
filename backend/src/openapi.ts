import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Share the exact OpenAPI setup between production and HTTP tests. */
export function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Product payment API')
    .setDescription('Single-product checkout and local payment status API')
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('api', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
