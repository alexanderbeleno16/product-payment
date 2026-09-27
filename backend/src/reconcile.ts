import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconcileKnownPayment } from './application/reconcile-known-payment';

const REFERENCE =
  /^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function main(): Promise<void> {
  const [reference, extra] = process.argv.slice(2);
  if (!reference || extra || !REFERENCE.test(reference)) {
    process.stderr.write(
      'Usage: npm run payment:reconcile -- <local-reference>\n',
    );
    process.exitCode = 2;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const result = await app.get(ReconcileKnownPayment).execute(reference);
    if (!result.ok) {
      process.stderr.write(`Reconciliation not applied: ${result.reason}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      JSON.stringify({
        reference: result.value.reference,
        paymentStatus: result.value.paymentStatus,
        fulfillmentStatus: result.value.fulfillmentStatus,
        applied: result.value.applied,
      }) + '\n',
    );
  } finally {
    await app.close();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Reconciliation failed; review server-side diagnostics.\n',
  );
  process.exitCode = 1;
});
