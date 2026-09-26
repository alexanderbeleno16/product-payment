---
name: typeorm-persistence
description: "Trigger: TypeORM, ORM, entity, repository, migration, database transaction, stock persistence. Design safe Nest persistence adapters for checkout."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when designing or implementing TypeORM persistence in `backend/`, including entities, migrations, repositories, seeds, transactions, and database tests. Read the [TypeORM field guide](references/field-guide.md) before work. This skill records an ORM direction, not an installed dependency or a database-engine decision.

## Hard Rules
- Keep TypeORM entities, `Repository`, `EntityManager`, and decorators in infrastructure. Domain models and application ports must not import them.
- Use the Data Mapper style: implement core-owned persistence ports in adapters; wire them with Nest providers at the composition root. Do not equate a TypeORM entity with a domain aggregate or an HTTP DTO.
- Persist server-authoritative price, quantity, and transaction state. Never persist or log card number, security code, expiry, or other raw payment credentials.
- Create pending transactions before external processing; only a confirmed success may decrement stock and create delivery. Rejections, unknown outcomes, retries, and duplicate notifications must not duplicate side effects.
- Make the stock decrement conditional and atomic; enforce invariants with database constraints and unique keys as well as use-case checks. A plain read-then-save is insufficient under concurrency.
- Use migrations; never enable schema `synchronize` in a deployed environment. Do not hold a database transaction open across a network payment request.
- Verify actual TypeORM, `@nestjs/typeorm`, Node, TypeScript, and driver versions before adopting an API; the scaffold currently installs no ORM.

## Decision Gates
| Question | Action |
| --- | --- |
| Engine not chosen | Keep engine-specific SQL, locks, and column types undecided; confirm the engine before implementation. |
| Several writes must succeed together | Use one database transaction and its transactional manager for every participating query. |
| External outcome is pending or unknown | Persist/reconcile state; do not infer success or failure from timeout. |
| Repeated command or callback | Use stable idempotency identity and database uniqueness before applying effects. |
| ORM/version example differs | Check installed versions and official docs; run build, Jest, and integration checks. |

## Execution Steps
1. Map the required product, transaction, customer, and delivery data and business invariants before defining tables.
2. Define core ports and plain domain models; place TypeORM mappings and port adapters at the infrastructure boundary.
3. Add reviewed migrations, deterministic dummy-product seed, constraints, and explicit transactional/idempotent write strategy.
4. Test success, rejection, pending/unknown, duplicate, and concurrent purchase paths against the chosen database; measure backend Jest coverage separately.

## Output Contract
Report model and migration choices, port-to-adapter bindings, transaction/concurrency strategy, version checks, and observed test evidence. Identify unverified database behavior rather than claiming it works.

## References
Read the local [TypeORM field guide](references/field-guide.md) and [shared primary-source map](../_shared/sources.md).
