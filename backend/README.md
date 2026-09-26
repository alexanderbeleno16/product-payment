# Backend

NestJS and TypeScript API for a single-product checkout. The current backend milestone provides PostgreSQL-backed dummy products and a read-only product endpoint. Checkout, payment, stock decrement, and delivery are **not implemented** yet.

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

There is no product-creation, checkout, payment, customer, or delivery endpoint yet. Public API documentation/collection and a hosted API URL remain future delivery items.

## Data and architecture

The current migration creates only `products`: UUID primary key, name, description, three-letter uppercase currency, positive integer `price_cents`, and nonnegative integer stock. Two deterministic dummy products are inserted by the explicit seed command. There are no transaction, customer, or delivery tables yet.

`GetProduct` and its `ProductReader` port live in `src/application/` without NestJS or TypeORM dependencies. The HTTP controller maps path validation and missing-product behavior; a TypeORM adapter maps the database row to the application product. `ProductsModule` binds the adapter to the port. The repository-root [architecture diagrams](../README.md#1-application-architecture-proposed) show the intended full checkout, not functionality already present.

## Verify

Run from `backend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand --coverageReporters=text-summary
```

Unit and HTTP E2E tests use a fake `ProductReader`; they do not require PostgreSQL and do not prove the database connection. The local migration/seed run plus the HTTP smoke request above exercise the real database path. Coverage is measured for this backend alone; it is not yet the final challenge-wide coverage claim. The frontend Jest runner and payment-path tests are future work.

On 2026-09-26, `npm run test:cov -- --runInBand --coverageReporters=text-summary` measured 41.44% statements, 36.84% branches, 45.45% functions, and 38.38% lines across `src/`, including the one-off migration and seed scripts. This is **below** the brief's final greater-than-80% per-application target; future work must add meaningful coverage rather than exclude files to inflate the result.
