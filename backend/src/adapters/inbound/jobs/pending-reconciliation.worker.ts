import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ReconcilePendingPayments } from '../../../application/reconcile-pending-payments';

function boundedInteger(
  name: string,
  fallback: number,
  low: number,
  high: number,
): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new Error(`${name} must be an integer between ${low} and ${high}`);
  }
  return value;
}

@Injectable()
export class PendingReconciliationWorker
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PendingReconciliationWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stopped = false;

  constructor(private readonly reconcile: ReconcilePendingPayments) {}

  onModuleInit(): void {
    if (process.env.PAYMENT_RECONCILIATION_ENABLED !== 'true') return;
    const interval = boundedInteger(
      'PAYMENT_RECONCILIATION_INTERVAL_SECONDS',
      15,
      5,
      300,
    );
    const batch = boundedInteger('PAYMENT_RECONCILIATION_BATCH_SIZE', 5, 1, 5);
    const minAge = boundedInteger(
      'PAYMENT_RECONCILIATION_MIN_AGE_SECONDS',
      30,
      15,
      3600,
    );
    const lease = boundedInteger(
      'PAYMENT_RECONCILIATION_LEASE_SECONDS',
      120,
      90,
      300,
    );
    this.timer = setInterval(() => {
      void this.tick(batch, minAge, lease);
    }, interval * 1000);
    this.timer.unref();
    this.logger.log('Pending-payment recovery enabled');
  }

  async tick(batch: number, minAge: number, lease: number): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const result = await this.reconcile.run(batch, minAge, lease);
      if (result.failures)
        this.logger.warn(
          `Pending-payment recovery: ${result.failures} unresolved of ${result.checked}`,
        );
    } catch {
      this.logger.warn('Pending-payment recovery cycle unavailable');
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
}
