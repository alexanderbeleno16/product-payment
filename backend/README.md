# Backend

NestJS and TypeScript API for a single-product checkout. The current backend has PostgreSQL-backed dummy products, a read-only product endpoint, and application/persistence logic for server-priced, idempotent PENDING checkouts. The checkout logic is **not yet exposed by HTTP**; sandbox submission, stock decrement, and delivery are not implemented.

## Run locally

Prerequisites: Node.js 24, npm 11, and Docker (or an existing PostgreSQL 17 server). These versions match the local verification environment; supported version ranges have not been established yet.

From the repository root, start a disposable local database:

```bash
docker run --name product-payment-postgres \
  -e POSTGRES_USER=checkout \
  -e POSTGRES_PASSWORD=local-only \
  -e POSTGRES_DB=checkout \
  -p 127.0.0.1:5432:5432 \
  -d postgres:17-alpine
```

`local-only` is an illustrative password for this disposable database, **not** an application credential. Do not reuse it outside local development. If port 5432 or the container name is already in use, use a different local port/name and adjust `DATABASE_URL` accordingly.

In a second terminal:

```bash
cd backend
npm ci
export DATABASE_URL='postgresql://checkout:local-only@127.0.0.1:5432/checkout'
npm run build
npm run db:migrate
npm run db:seed
npm run start:dev
```

The API listens at `http://localhost:3000` by default (`PORT` may override it). `DATABASE_URL` is required; no `.env` file is loaded automatically. Wait for PostgreSQL to accept connections before running the migration. Migrations are explicit—runtime synchronization and automatic migration execution are disabled. The seed may be run again: fixed product IDs prevent duplicates and existing stock is not reset.

To stop and remove the disposable database:

```bash
docker stop product-payment-postgres
docker rm -v product-payment-postgres
```

`-v` also removes the container's anonymous data volume; use a named persistent volume if you need to keep local data. Never use these local credentials or this disposable setup for deployment.

## Implemented API

`GET /products/:id` reads one product, including current stock. It does not change stock or create a checkout. The route is currently unauthenticated; do not treat it as a transaction-status or buyer-data endpoint.

The seeded IDs are `8a52ea31-08d9-4f52-a604-00e56143dce0` and `3685f095-a601-4ca6-ab54-0f8eb66bccd8`. For example:

```bash
curl -i http://localhost:3000/products/8a52ea31-08d9-4f52-a604-00e56143dce0
```

Successful response (`200 OK`):

```json
{
  "id": "8a52ea31-08d9-4f52-a604-00e56143dce0",
  "name": "Wireless Headphones",
  "description": "Over-ear wireless headphones",
  "currency": "COP",
  "priceCents": 12990000,
  "stock": 12
}
```

`priceCents` is an integer in the server's currency representation; clients must not submit their own price as authoritative. Stock is a nonnegative integer and is read only in this milestone.

| Result | Status | Behavior |
| --- | --- | --- |
| Existing UUID v4 | `200` | Product fields above, read from PostgreSQL. |
| Malformed or non-v4 ID | `400` | Nest validation error; persistence is not queried. |
| Well-formed but absent UUID v4 | `404` | `Product not found`. |

There is no product-creation, checkout, payment, customer, or delivery endpoint yet. The checkout use cases are internal until a later work unit exposes a validated HTTP contract. Public API documentation/collection and a hosted API URL remain future delivery items.

## Data and architecture

The first migration creates `products`: UUID primary key, name, description, three-letter uppercase currency, positive integer `price_cents`, and nonnegative integer stock. Two deterministic dummy products are inserted by the explicit seed command. A second versioned migration adds `customers` and `transactions`. The latter stores a PENDING status, unique transaction reference and idempotency key, canonical request fingerprint, quantity, product/fee/total snapshot in integer COP cents, and nullable provider-submission timestamp and provider transaction ID. Customer email and delivery details are stored with the checkout; no delivery record exists before confirmed success.

The current **demo fee policy**, not an amount prescribed by the brief, is COP 2,000 base plus COP 5,000 delivery. A separate demo policy caps one checkout at COP 20,000,000; this is an application rule, not a database rule. `QuoteCheckout` validates a UUID v4 before product lookup and computes `(unit price × quantity) + both fees` with amount-cap and stock checks. `StartCheckout` first checks the idempotency key: matching canonical business data returns the original snapshot even if price or stock changed, while different data conflicts. The fingerprint excludes payment tokens. New customer and transaction rows are inserted atomically; PostgreSQL uniqueness handles competing first requests and rolls back the losing customer. A separate conditional update can durably claim provider submission once before network I/O. It is not yet invoked by an HTTP route. No stock is reserved or decremented when a PENDING checkout is created.

Plain product/quote values, payment status, and pricing rules live in `src/domain/`; use-case commands, results, `GetProduct`, `QuoteCheckout`, `StartCheckout`, and capability ports live in `src/application/`. Neither inner directory imports NestJS or TypeORM. Nest controllers in `src/adapters/inbound/http/` map HTTP input and output; TypeORM adapters in `src/adapters/outbound/persistence/` map storage records to plain values. Nest modules at `src/` bind adapters to ports. A lazily initialized `DatabaseConnection` owns one shared connection and its shutdown. This organization makes the dependency direction visible, but the isolated core tests and adapter tests—not directory names alone—verify it. The repository-root [architecture diagrams](../README.md#1-application-architecture-proposed) show the intended full checkout, not functionality already present.

## Verify

Run from `backend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand --coverageReporters=text-summary
```

Unit and HTTP E2E tests use fake ports and do not require PostgreSQL. A separate conditional test exercises migrations, idempotency races, original-price replay, and one-time submission claim against a real isolated PostgreSQL database when `CHECKOUT_TEST_DATABASE_URL` points to a database whose name ends in `_test`. With the local container above, first create an isolated test database, then run:

```bash
docker exec product-payment-postgres psql -U checkout -d checkout -c 'CREATE DATABASE checkout_p2_test'
CHECKOUT_TEST_DATABASE_URL='postgresql://checkout:local-only@127.0.0.1:5432/checkout_p2_test' npm test -- --runInBand
```

Without this variable, the PostgreSQL suite is skipped rather than replaced with a mock. Coverage is measured for this backend alone; it is not yet the final challenge-wide coverage claim. The frontend Jest runner and payment-path tests are future work.

On 2026-09-26, `CHECKOUT_TEST_DATABASE_URL=... npm run test:cov -- --runInBand --coverageReporters=text-summary` measured 66.91% statements, 68.04% branches, 60.46% functions, and 68.08% lines across `src/`, including one-off migration and seed scripts. This is **below** the brief's final greater-than-80% per-application target; further behavior tests are still needed. Without the real-database variable, the PostgreSQL test suite is skipped and the measured percentages are lower.
