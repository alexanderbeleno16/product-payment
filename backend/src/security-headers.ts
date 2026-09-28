import type { INestApplication } from '@nestjs/common';

/** Apply the same API response policy in production and HTTP tests. */
export function configureSecurityHeaders(app: INestApplication): void {
  app.useSecurityHeaders({
    // TLS termination and domain coverage must be verified before enabling HSTS.
    strictTransportSecurity: false,
  });
}
