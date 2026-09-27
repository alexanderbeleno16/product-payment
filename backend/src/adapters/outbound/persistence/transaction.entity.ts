import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PaymentStatus } from '../../../domain/checkout';

@Entity({ name: 'transactions' })
export class TransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents!: number;

  @Column({ name: 'product_amount_cents', type: 'integer' })
  productAmountCents!: number;

  @Column({ name: 'base_fee_cents', type: 'integer' })
  baseFeeCents!: number;

  @Column({ name: 'delivery_fee_cents', type: 'integer' })
  deliveryFeeCents!: number;

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents!: number;

  @Column({ type: 'varchar', length: 24 })
  status!: PaymentStatus;

  @Column({ type: 'varchar', length: 64 })
  reference!: string;

  @Column({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Column({
    name: 'submission_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  submissionStartedAt!: Date | null;

  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  providerTransactionId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
