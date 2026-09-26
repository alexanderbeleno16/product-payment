# TypeORM persistence field guide

This is project-specific guidance for the NestJS checkout API, not a claim that TypeORM, a driver, or a database is installed. The brief permits any ORM and database, recommends PostgreSQL or DynamoDB, requires seeded dummy products, and expects product, stock, transaction, customer, and delivery behavior. Confirm the database engine separately; TypeORM is the selected direction for persistence guidance because its decorator/entity/repository style is familiar to a JPA developer. Similar syntax does **not** imply identical JPA/Hibernate lifecycle or transaction semantics.

## Priority map

| Priority | Concern | Failure if ignored |
| --- | --- | --- |
| Critical | Confirmed-success boundary | A failed or unknown payment reduces stock or creates delivery. |
| Critical | Atomic stock and idempotent effects | Concurrent buyers oversell; retries duplicate delivery. |
| Critical | Sensitive-data boundary | Raw card data or credentials reach the database or logs. |
| High | ORM/domain separation | Framework and table shapes become the business contract. |
| High | Reproducible schema and seed | Fresh clone or deployment cannot reproduce the test data. |

### R01 — Verify the runtime before copying a snippet

Inspect `backend/package.json`, the lockfile, installed package versions, `backend/tsconfig.json`, and the emitted module format. The current scaffold uses Nest 12, TypeScript `nodenext`, and CommonJS output, but does not install TypeORM. Choose compatible TypeORM, `@nestjs/typeorm`, and driver versions explicitly. The Nest 12 integration package is ESM; modern Node can consume it from CommonJS, but build, startup, and Jest must prove the exact installed combination. If AWS Lambda is chosen, check its `require(esm)` runtime behavior separately; Nest's migration guide notes that Lambda disables it by default. Do not silently switch the entire backend to ESM just to copy an example. TypeORM 0.3 and 1.x documentation can differ; verify the selected major before using APIs or migrations.

### R02 — Treat TypeORM as an outer adapter, not the domain

Core use cases own the meaning of `Product`, `Transaction`, `Customer`, and `Delivery` and the ports they need. TypeORM-decorated classes describe table mappings in infrastructure. An adapter converts persistence records to/from core models and implements a capability-oriented port. The Nest module binds the port token to the adapter. Do not expose `Repository<Entity>`, `EntityManager`, decorators, lazy relation proxies, or ORM errors through core contracts. Prefer Data Mapper/repositories over TypeORM Active Record for this boundary. Do not introduce a repository abstraction for a use case that does not need persistence.

### R03 — Design the data model around the checkout lifecycle

Define the product's canonical price, currency/units, and nonnegative stock; transaction identifier, selected product, quantity, amount breakdown, status, external reference, and timestamps; customer/delivery data and relations according to the actual API contract. Specify whether a delivery record exists only after success. Preserve enough information to reconcile an external result without storing payment credentials. The server recomputes price and fees; never trust client-supplied totals or a client assertion that payment succeeded. Do not prematurely choose a database-specific `decimal`, JSON, lock, or identity type while the engine is undecided. Once chosen, document precision/rounding and serialization of money; do not use binary floating-point for authoritative amounts.

### R04 — Express lifecycle transitions and invariants

The pending transaction is recorded before an external payment attempt. Treat `PENDING`, confirmed success, confirmed rejection, and unknown/in-progress as distinct outcomes. A timeout is not a rejection. Only a verified successful outcome can trigger stock decrement and delivery creation, once. Enforce allowed state transitions in a use case and make the database update conditional on the expected prior state. External provider calls are outside the database transaction: a local transaction cannot make an HTTP call atomic. Define a reconciliation/retry policy for gaps between external success and local persistence, rather than holding a row lock across the network call.

### R05 — Make the successful local effect atomic and concurrent-safe

Within one database transaction, guard the transition to success, decrement stock only when sufficient quantity remains, and create exactly one delivery. Use the transaction's `EntityManager` (or repositories derived from it) for **every** query participating in the transaction; a globally injected repository would execute outside that transaction. A read-then-`save` without a lock or conditional update permits lost updates. Choose the exact conditional-update or locking strategy after confirming the engine and selected TypeORM version; assert affected-row counts and fail safely if stock is insufficient. Add database checks such as nonnegative stock where supported and unique constraints on transaction number, external reference/idempotency key, and delivery-per-transaction as appropriate. A TypeORM `decrement` alone does not prove sufficient stock or idempotency.

### R06 — Make retries safe at the database boundary

Choose one stable transaction/request identity and document how retries and external notifications map to it. Replaying a confirmed success must return the existing result, not charge, decrement, or deliver again. Define how duplicate pending requests and late rejection/success events interact with terminal states. Use unique indexes/constraints to resolve races, not only in-memory flags. Map uniqueness violations and expected stock conflicts into typed application outcomes; do not leak SQL errors to HTTP.

### R07 — Migrations and deterministic seed

Use versioned migrations for schema changes and set `synchronize: false` in deployed environments; do not rely on auto-sync as a migration mechanism. Keep migration execution and rollback explicit for local setup and AWS deployment. Seed dummy products deterministically and idempotently so rerunning setup does not duplicate products or overwrite real stock unexpectedly. Keep seed inputs free of card data and secrets. Document migration/seed commands only after they are implemented and verified. Review generated migrations for indexes, defaults, decimal types, constraints, and destructive changes before applying them.

### R08 — Test the boundaries that mocks cannot prove

Unit-test application decisions with fake ports. Test adapter mappings, uniqueness, transactions, conditional stock updates, and migrations against the selected database engine; an in-memory substitute may not reproduce its locking or column semantics. Add concurrent purchase and duplicate-callback tests, plus rejection and unknown-outcome paths. Run existing backend build/lint/Jest/E2E checks and report skipped integration tests honestly. Measure the brief's `>80%` Jest coverage rather than inferring it from green scaffold tests.

## Review checklist

- Are core and HTTP contracts free of TypeORM classes and decorators?
- Are price, stock, and success status authoritative on the server?
- Is each successful local effect atomic and safe under concurrent requests?
- Can a rejection, timeout, retry, or duplicate event alter stock or create a second delivery?
- Does every transaction query use its transactional manager?
- Can a fresh environment apply migrations and seed without auto-sync or secrets?
- Were the chosen engine, package versions, startup, Jest, and real-database behavior verified?

## Primary sources

- [Nest database integrations](https://docs.nestjs.com/techniques/database)
- [Nest TypeORM integration](https://docs.nestjs.com/data/typeorm)
- [Nest 12 migration and CommonJS interop](https://docs.nestjs.com/migration-guide)
- [TypeORM: Active Record versus Data Mapper](https://typeorm.io/docs/guides/active-record-data-mapper/)
- [TypeORM: transactions](https://typeorm.io/docs/transactions/)
- [TypeORM: migrations setup](https://typeorm.io/docs/migrations/setup/)
- [TypeORM: repository API](https://typeorm.io/docs/working-with-entity-manager/repository-api/)
- [TypeORM: locking with QueryBuilder](https://typeorm.io/docs/query-builder/select-query-builder/)
