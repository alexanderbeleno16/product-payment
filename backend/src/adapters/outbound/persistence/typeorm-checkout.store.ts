import { randomUUID } from 'node:crypto';
import type { QueryFailedError } from 'typeorm';
import type {
  CheckoutStore,
  NewPendingCheckout,
} from '../../../application/checkout-store.port';
import type { PaymentSubmissionOutcome } from '../../../application/payment-gateway.port';
import { IdempotencyKeyTaken } from '../../../application/checkout-store.port';
import type { CheckoutTransaction } from '../../../application/checkout';
import { isFinalPaymentStatus } from '../../../domain/checkout';
import { CustomerEntity } from './customer.entity';
import { DatabaseConnection } from './database-connection';
import { TransactionEntity } from './transaction.entity';

function toCheckout(entity: TransactionEntity): CheckoutTransaction {
  return {
    id: entity.id,
    reference: entity.reference,
    customerId: entity.customerId,
    idempotencyKey: entity.idempotencyKey,
    requestFingerprint: entity.requestFingerprint,
    productId: entity.productId,
    quantity: entity.quantity,
    currency: 'COP',
    unitPriceCents: entity.unitPriceCents,
    productAmountCents: entity.productAmountCents,
    baseFeeCents: entity.baseFeeCents,
    deliveryFeeCents: entity.deliveryFeeCents,
    totalCents: entity.totalCents,
    status: entity.status,
    fulfillmentStatus: entity.fulfillmentStatus,
    submissionStartedAt: entity.submissionStartedAt,
    providerTransactionId: entity.providerTransactionId,
    createdAt: entity.createdAt,
  };
}

export class TypeOrmCheckoutStore implements CheckoutStore {
  constructor(private readonly connection: DatabaseConnection) {}

  async findByIdempotencyKey(key: string): Promise<CheckoutTransaction | null> {
    const dataSource = await this.connection.get();
    const entity = await dataSource.getRepository(TransactionEntity).findOneBy({
      idempotencyKey: key,
    });
    return entity ? toCheckout(entity) : null;
  }

  async createPending(
    command: NewPendingCheckout,
  ): Promise<CheckoutTransaction> {
    const dataSource = await this.connection.get();
    try {
      return await dataSource.transaction(async (manager) => {
        const customerId = randomUUID();
        await manager.insert(CustomerEntity, {
          id: customerId,
          email: command.input.customerEmail,
          recipientName: command.input.delivery.recipientName,
          addressLine: command.input.delivery.addressLine,
          city: command.input.delivery.city,
        });
        const entity = manager.create(TransactionEntity, {
          id: command.id,
          customerId,
          productId: command.quote.productId,
          quantity: command.quote.quantity,
          currency: command.quote.currency,
          unitPriceCents: command.quote.unitPriceCents,
          productAmountCents: command.quote.productAmountCents,
          baseFeeCents: command.quote.baseFeeCents,
          deliveryFeeCents: command.quote.deliveryFeeCents,
          totalCents: command.quote.totalCents,
          status: 'PENDING',
          fulfillmentStatus: 'NOT_STARTED',
          reference: command.reference,
          idempotencyKey: command.input.idempotencyKey,
          requestFingerprint: command.requestFingerprint,
          submissionStartedAt: null,
          providerTransactionId: null,
          createdAt: new Date(),
        });
        await manager.insert(TransactionEntity, entity);
        return toCheckout(entity);
      });
    } catch (error) {
      const failure = error as QueryFailedError & {
        driverError?: { code?: string; constraint?: string };
      };
      if (
        failure.driverError?.code === '23505' &&
        failure.driverError.constraint === 'transactions_idempotency_key_key'
      ) {
        throw new IdempotencyKeyTaken();
      }
      throw error;
    }
  }

  async claimSubmission(reference: string): Promise<boolean> {
    const dataSource = await this.connection.get();
    const result = await dataSource
      .createQueryBuilder()
      .update(TransactionEntity)
      .set({
        submissionStartedAt: new Date(),
        status: 'SUBMISSION_UNKNOWN',
      })
      .where(
        'reference = :reference AND submission_started_at IS NULL AND status = :status',
        {
          reference,
          status: 'PENDING',
        },
      )
      .execute();
    return result.affected === 1;
  }

  async recordSubmissionOutcome(
    reference: string,
    outcome: PaymentSubmissionOutcome,
  ): Promise<CheckoutTransaction> {
    const dataSource = await this.connection.get();
    const status =
      outcome.kind === 'UNKNOWN'
        ? 'SUBMISSION_UNKNOWN'
        : outcome.kind === 'REJECTED'
          ? 'SUBMISSION_REJECTED'
          : 'PENDING';
    const result = await dataSource
      .createQueryBuilder()
      .update(TransactionEntity)
      .set({
        status,
        providerTransactionId:
          outcome.kind === 'ACCEPTED' ? outcome.providerTransactionId : null,
      })
      .where(
        'reference = :reference AND status = :unknown AND submission_started_at IS NOT NULL AND provider_transaction_id IS NULL',
        { reference, unknown: 'SUBMISSION_UNKNOWN' },
      )
      .execute();
    const entity = await dataSource.getRepository(TransactionEntity).findOneBy({
      reference,
    });
    if (!entity) throw new Error('Recorded checkout disappeared');
    if (result.affected !== 1) {
      if (entity.submissionStartedAt === null) {
        throw new Error('Submission outcome could not be recorded');
      }
      const eventWon =
        isFinalPaymentStatus(entity.status) ||
        (entity.status === 'PENDING' && entity.providerTransactionId !== null);
      if (eventWon) {
        if (
          outcome.kind === 'ACCEPTED' &&
          entity.providerTransactionId !== outcome.providerTransactionId
        ) {
          throw new Error('Provider transaction identity conflict');
        }
        return toCheckout(entity);
      }
      if (
        (outcome.kind === 'UNKNOWN' &&
          entity.status === 'SUBMISSION_UNKNOWN') ||
        (outcome.kind === 'REJECTED' && entity.status === 'SUBMISSION_REJECTED')
      ) {
        return toCheckout(entity);
      }
      throw new Error('Submission outcome could not be recorded');
    }
    return toCheckout(entity);
  }
}
