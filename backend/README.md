# Backend

NestJS and TypeScript API for a single-product checkout. The current backend exposes product reading, server-priced quotes, current payment consents, idempotent checkout initiation, and limited local transaction-status reads. It persists PENDING checkouts and can submit one sandbox payment attempt through an outbound adapter. Provider confirmation, stock decrement, and delivery are **not implemented**.

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
# First supply all PAYMENT_* variables described below from approved, untracked local configuration.
npm run start:dev
```

The API listens at `http://localhost:3000` by default (`PORT` may override it). Local interactive API documentation is at [Swagger UI](http://localhost:3000/api); its generated [OpenAPI JSON](http://localhost:3000/api-json) describes the same running routes. These are **local URLs**, not verified public deployment links. `DATABASE_URL` and all five `PAYMENT_*` values below are required at application startup, even for product-only reads; no `.env` file is loaded automatically. Keep payment credentials and secret values in untracked, server-side configuration. The adapter requires an independently configured exact sandbox hostname and matching endpoint/key families. Configuration does **not** authorize a live sandbox request; the integration has been tested with fake transport only.

| Variable | Purpose |
| --- | --- |
| `PAYMENT_API_BASE_URL` | Approved HTTPS sandbox API base URL ending in `/v1`. |
| `PAYMENT_SANDBOX_HOST` | Exact approved hostname of that sandbox API, without protocol or port; must match the base URL. |
| `PAYMENT_PUBLIC_KEY` | Sandbox public merchant key for current consent documents. |
| `PAYMENT_PRIVATE_KEY` | Server-only sandbox key for transaction submission. |
| `PAYMENT_INTEGRITY_SECRET` | Server-only sandbox integrity secret for amount/reference signing. |

Wait for PostgreSQL to accept connections before running the migration. Migrations are explicit—runtime synchronization and automatic migration execution are disabled. The seed may be run again: fixed product IDs prevent duplicates and existing stock is not reset.

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

The generated scaffold's `GET /` also remains but is excluded from the checkout OpenAPI document. There is no product-creation, customer CRUD, delivery, signed-event, or payment-finalization endpoint. A publicly hosted Swagger/OpenAPI URL and API URL remain future delivery items.

### Checkout HTTP contract

The routes below return `Cache-Control: no-store` and are described in the generated [local OpenAPI document](http://localhost:3000/api-json). Their prices, fees, references, and payment status are server-owned; no raw card details belong in API requests. The browser must obtain a transient card token directly from Empresa innombrable before `POST /checkouts`.

| Method and path | Input | Success | Expected rejection |
| --- | --- | --- | --- |
| `GET /checkout/quote` | Query: `productId` (UUID v4), `quantity` (positive integer string). | `200` with `productId`, `quantity`, `currency`, `unitPriceCents`, `productAmountCents`, `baseFeeCents`, `deliveryFeeCents`, `totalCents`. | `400` invalid input, `404` missing product, `409` insufficient stock, `422` unsupported currency. |
| `GET /checkout/consents` | No buyer input. | `200` with sandbox `publicKey` and two current consent documents (`token`, `permalink`). | `503` if current documents cannot be read; no remote error details are exposed. |
| `POST /checkouts` | `Idempotency-Key` header (UUID v4) and JSON body described below. | `201` with `reference`, local `status`, and server-calculated `quote`. Same-key/same-data replay returns the original result without another submission. | `400` invalid body/header or missing consent, `404` missing product, `409` stock/idempotency conflict, `422` unsupported currency. |
| `GET /transactions/:reference` | Transaction reference plus the original `Idempotency-Key` header (UUID v4). | `200` with only `reference` and local `status`. This read does not call the provider. | `400` invalid reference/header, `404` unknown reference or nonmatching key. |

The checkout JSON body has `productId` (UUID v4), `quantity` (positive integer), `installments` (buyer-selected positive safe integer for the CARD payment), `customerEmail`, `delivery` (`recipientName`, `addressLine`, `city`), transient `cardToken`, `acceptanceToken`, `personalDataToken`, and both explicit booleans `acceptsEndUserPolicy: true` and `acceptsPersonalDataAuthorization: true`. No provider-defined maximum installment count has been verified; the provider may reject an unsupported selection. The two consent tokens come from the current consent documents. Unknown body fields, including client-supplied price or status, are rejected; the HTTP response omits email, delivery details, tokens, provider ID, and idempotency key. The current status lookup uses the idempotency key as a shared secret but is **not** a complete authorization design for public deployment.

`PENDING` means submission acknowledgement, **not** approval. `SUBMISSION_UNKNOWN` means the external outcome is uncertain and must not trigger a blind retry. `SUBMISSION_REJECTED` is a local submission-authentication rejection. A 201 response never proves a completed purchase, stock decrement, or delivery. No live sandbox call or publicly hosted endpoint has been verified.

## Data and architecture

The first migration creates `products`: UUID primary key, name, description, three-letter uppercase currency, positive integer `price_cents`, and nonnegative integer stock. Two deterministic dummy products are inserted by the explicit seed command. A second versioned migration adds `customers` and `transactions`. The latter stores a PENDING status, unique transaction reference and idempotency key, canonical request fingerprint, quantity, product/fee/total snapshot in integer COP cents, and nullable provider-submission timestamp and provider transaction ID. Customer email and delivery details are stored with the checkout; no delivery record exists before confirmed success.

The current **demo fee policy**, not an amount prescribed by the brief, is COP 2,000 base plus COP 5,000 delivery. A separate demo policy caps one checkout at COP 20,000,000; this is an application rule, not a database rule. `QuoteCheckout` validates a UUID v4 before product lookup and computes `(unit price × quantity) + both fees` with amount-cap and stock checks. `StartCheckout` first checks the idempotency key: matching canonical business data returns the original snapshot even if price or stock changed, while different data conflicts. The fingerprint excludes payment tokens but includes a non-default installment selection; one installment keeps the original fingerprint for backward replay compatibility. New customer and transaction rows are inserted atomically; PostgreSQL uniqueness handles competing first requests and rolls back the losing customer. A separate conditional update can durably claim provider submission once before network I/O. The `POST /checkouts` route now invokes this path. No stock is reserved or decremented when a PENDING checkout is created.

The internal `InitiatePayment` use case now checks for all three transient payment/consent tokens before creating a PENDING checkout, then atomically marks its reference `SUBMISSION_UNKNOWN` while claiming it once before invoking a `PaymentGateway` port. A sandbox-only outbound adapter supports both the official test environment and the challenge's UAT sandbox, with matching key families; it constructs the provider request from the stored server-calculated total and reference, signs it with the private integrity secret, and accepts only a matching `201`/`PENDING` response as an acknowledged submission. Acknowledgement is **not** payment approval. An authentication rejection becomes local `SUBMISSION_REJECTED`; timeout, validation response, server error, or malformed response remains `SUBMISSION_UNKNOWN` because non-submission is not proved. Outcomes and the provider ID are conditionally persisted without storing card or acceptance tokens. A retry of the same idempotency key reads the original snapshot and cannot send a second request. A process crash after the durable claim leaves `SUBMISSION_UNKNOWN` without a provider ID; this must be reconciled rather than resent. The route is bound locally, but provider behavior has only been tested with fake transport; no live sandbox call has been verified.

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

Most unit and HTTP E2E tests use fake ports and do not require PostgreSQL. Conditional integration tests exercise migrations and seed lifecycle, idempotency races, original-price replay, and one-time submission claim against real PostgreSQL when `CHECKOUT_TEST_DATABASE_URL` points to a database whose name ends in `_test`. The migration/seed test creates and removes a further isolated test database, so the test user needs `CREATEDB` permission. With the disposable local container above, create the parent test database, then run:

```bash
docker exec product-payment-postgres psql -U checkout -d checkout -c 'CREATE DATABASE checkout_p2_test'
CHECKOUT_TEST_DATABASE_URL='postgresql://checkout:local-only@127.0.0.1:5432/checkout_p2_test' npm test -- --runInBand
```

Without this variable, the PostgreSQL suites are skipped rather than replaced with mocks. Coverage is measured for this backend alone; it is not yet the final challenge-wide coverage claim. The frontend Jest runner is future work. Checkout HTTP E2E tests use fake persistence and payment/consent adapters, not real sandbox credentials.

On 2026-09-26, with an isolated PostgreSQL test database, `CHECKOUT_TEST_DATABASE_URL=... npm run test:cov -- --runInBand --coverageReporters=text-summary` passed **76 unit tests** and measured **90.55% statements, 85.62% branches, 82.92% functions, and 90.42% lines** across `src/`, including the HTTP adapter, migration, and seed scripts. Separately, `npm run test:e2e -- --runInBand` passed **14 HTTP E2E tests** using fake payment and consent adapters. The backend now exceeds 80% in every measured Jest coverage metric; this does **not** establish frontend coverage or prove a live sandbox transaction. Without the real-database variable, PostgreSQL suites are skipped and the measured percentages are lower.
