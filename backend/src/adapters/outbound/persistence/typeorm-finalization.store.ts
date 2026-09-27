import { randomUUID } from 'node:crypto';
import type { QueryFailedError } from 'typeorm';
import type {
  FinalizationResult,
  FinalizationStore,
  VerifiedPaymentSnapshot,
} from '../../../application/finalize-verified-payment';
import {
  isFinalPaymentStatus,
  paymentTransition,
} from '../../../domain/checkout';
import { DatabaseConnection } from './database-connection';
import { DeliveryEntity } from './delivery.entity';
import { ProductEntity } from './product.entity';
import { TransactionEntity } from './transaction.entity';

export class TypeOrmFinalizationStore implements FinalizationStore {
  constructor(private readonly connection: DatabaseConnection) {}

  async finalize(
    snapshot: VerifiedPaymentSnapshot,
  ): Promise<FinalizationResult> {
    const dataSource = await this.connection.get();
    try {
      return await dataSource.transaction(async (manager) => {
        const transaction = await manager.findOne(TransactionEntity, {
          where: { reference: snapshot.reference },
          lock: { mode: 'pessimistic_write' },
        });
        if (!transaction) return { ok: false, reason: 'NOT_FOUND' };

        if (
          transaction.totalCents !== snapshot.amountCents ||
          transaction.currency !== snapshot.currency ||
          (transaction.providerTransactionId !== null &&
            transaction.providerTransactionId !==
              snapshot.providerTransactionId)
        ) {
          return { ok: false, reason: 'MISMATCH' };
        }
        if (transaction.submissionStartedAt === null) {
          return { ok: false, reason: 'NOT_SUBMITTED' };
        }

        const transition = paymentTransition(
          transaction.status,
          snapshot.status,
        );
        if (transition === 'CONFLICT') {
          return { ok: false, reason: 'TERMINAL_CONFLICT' };
        }
        if (transition === 'REPLAY' || transition === 'STALE') {
          if (!isFinalPaymentStatus(transaction.status)) {
            throw new Error('Terminal payment state invariant violated');
          }
          return {
            ok: true,
            value: {
              reference: transaction.reference,
              paymentStatus: transaction.status,
              fulfillmentStatus: transaction.fulfillmentStatus,
              applied: false,
            },
          };
        }

        let fulfillmentStatus = transaction.fulfillmentStatus;
        if (snapshot.status === 'APPROVED') {
          const stock = await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ stock: () => 'stock - :quantity' })
            .where('id = :productId AND stock >= :quantity', {
              productId: transaction.productId,
              quantity: transaction.quantity,
            })
            .execute();
          if (stock.affected === 1) {
            await manager.insert(DeliveryEntity, {
              id: randomUUID(),
              transactionId: transaction.id,
              customerId: transaction.customerId,
              productId: transaction.productId,
              quantity: transaction.quantity,
              createdAt: new Date(),
            });
            fulfillmentStatus = 'CREATED';
          } else {
            fulfillmentStatus = 'STOCK_UNAVAILABLE';
          }
        }

        await manager.update(TransactionEntity, transaction.id, {
          providerTransactionId: snapshot.providerTransactionId,
          status: snapshot.status,
          fulfillmentStatus,
        });
        return {
          ok: true,
          value: {
            reference: transaction.reference,
            paymentStatus: snapshot.status,
            fulfillmentStatus,
            applied: true,
          },
        };
      });
    } catch (error) {
      const failure = error as QueryFailedError & {
        driverError?: { code?: string; constraint?: string };
      };
      if (
        failure.driverError?.code === '23505' &&
        failure.driverError.constraint ===
          'transactions_provider_transaction_id_key'
      ) {
        return { ok: false, reason: 'MISMATCH' };
      }
      throw error;
    }
  }
}
