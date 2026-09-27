import { randomUUID } from 'node:crypto';
import type { QueryFailedError } from 'typeorm';
import type {
  FinalizationResult,
  FinalizationStore,
  VerifiedPaymentSnapshot,
} from '../../../application/finalize-verified-payment';
import {
  decideFinalization,
  fulfillmentAfterFinalization,
} from '../../../application/finalization-policy';
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
        const decision = decideFinalization(
          transaction && {
            reference: transaction.reference,
            totalCents: transaction.totalCents,
            currency: transaction.currency,
            providerTransactionId: transaction.providerTransactionId,
            submissionStarted: transaction.submissionStartedAt !== null,
            paymentStatus: transaction.status,
            fulfillmentStatus: transaction.fulfillmentStatus,
          },
          snapshot,
        );
        if (decision.kind === 'RETURN') return decision.result;
        if (!transaction)
          throw new Error('Finalization state invariant violated');

        let stockReserved = false;
        if (decision.needsStock) {
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
            stockReserved = true;
          }
        }
        const fulfillmentStatus = fulfillmentAfterFinalization(
          transaction.fulfillmentStatus,
          decision.needsStock,
          stockReserved,
        );

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
