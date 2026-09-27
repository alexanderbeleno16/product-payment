import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'deliveries' })
export class DeliveryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid', unique: true })
  transactionId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
