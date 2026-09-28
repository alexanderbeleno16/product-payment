# Backend

NestJS and TypeScript API for a single-product checkout. The backend exposes product reading, server-priced quotes, current payment consents, idempotent checkout initiation, signed payment-event receipt, and limited local transaction-status reads. It persists PENDING checkouts and can submit one sandbox payment attempt. The signed-event route fetches an authoritative transaction with the server-only private key before atomic local finalization. Local sandbox approval and success-only fulfillment have been observed after operator known-ID reconciliation, including a browser journey; a deployed callback and autonomous recovery have **not** been verified. An operator-only known-ID reconciliation path is implemented and tested locally.

## Run locally

Prerequisites: Docker with Compose for the two-container setup below. Node.js 24 and npm 11 are needed only for the host-run alternative or frontend development; these versions match the local verification environment, but supported version ranges have not been established yet.

On first setup only, copy the root `.env.example` to `.env` and choose a URL-safe local database password; do not overwrite an existing root `.env` when restarting, because the named volume retains its original database password. Supply the six approved `PAYMENT_*` variables in the separate, untracked `backend/.env` (see `backend/.env.example`). Keep real payment credentials out of the root `.env` and all tracked files. The container loads `backend/.env` only at runtime and overrides its host `DATABASE_URL` with the Compose database address.

```bash
test -f .env || cp .env.example .env
# First setup: edit the two local env files before starting.
docker compose up --build -d --wait
curl -i http://127.0.0.1:3000/products
```

Compose runs PostgreSQL 17 on `127.0.0.1:5433` and the compiled Nest API on `127.0.0.1:3000`. It waits for the database health check, then runs explicit migrations and the idempotent seed before serving the API. Data survives normal stops in the named `checkout_pgdata` volume. The Vite frontend remains a host process in `frontend/` (`npm run dev`) and proxies API routes to port 3000.

```bash
docker compose down                 # Stop API and database; retain data.
# docker compose down -v            # Destructive: also delete the local database volume.
```

Use `docker compose ps` and `docker compose logs api` to diagnose startup failures. The API requires valid server-only payment configuration even for product reads. This Compose stack is for local development, not a deployed API or HTTPS boundary.

### Host-run alternative

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
# First supply all six PAYMENT_* variables described below from approved, untracked local configuration.
npm run start:dev
```

The API listens at `http://localhost:3000` by default (`PORT` may override it). Local interactive API documentation is at [Swagger UI](http://localhost:3000/api); its generated [OpenAPI JSON](http://localhost:3000/api-json) describes the same running routes. These are **local URLs**, not verified public deployment links. `DATABASE_URL` and all six `PAYMENT_*` values below are required at application startup, even for product-only reads; no `.env` file is loaded automatically. The committed [environment template](.env.example) lists required names with no values and is not an executable setup. In particular, `PAYMENT_EVENTS_SECRET` must be the separate sandbox events secret. Keep payment credentials and secret values in untracked, server-side configuration. The adapter requires an independently configured exact sandbox hostname and matching endpoint/key families. Configuration alone does **not** authorize live sandbox requests; one separately authorized synthetic UAT initiation was verified on 2026-09-26 (see [Verify](#verify)).

The Nest API applies its built-in security headers to successful and error responses, including CSP, `X-Content-Type-Options`, and `Referrer-Policy`, and suppresses `X-Powered-By`. HSTS is intentionally disabled until public HTTPS, certificate and domain coverage, and the TLS-terminating edge are verified. These API headers do not protect a separately hosted SPA; its serving layer needs its own policy. Local HTTP and header tests do not establish a secure AWS deployment.

| Variable | Purpose |
| --- | --- |
| `PAYMENT_API_BASE_URL` | Approved HTTPS sandbox API base URL ending in `/v1`. |
| `PAYMENT_SANDBOX_HOST` | Exact approved hostname of that sandbox API, without protocol or port; must match the base URL. |
| `PAYMENT_PUBLIC_KEY` | Sandbox public merchant key for current consent documents. |
| `PAYMENT_PRIVATE_KEY` | Server-only sandbox key for transaction submission and authoritative status reads. |
| `PAYMENT_INTEGRITY_SECRET` | Server-only sandbox integrity secret for amount/reference signing. |
| `PAYMENT_EVENTS_SECRET` | Separate server-only sandbox events secret for signed callback verification; it is not the private key or integrity secret. |

The tokenization bridge uses only the server-configured exact HTTPS sandbox host and matching public-key family, fixed paths, no redirects, and bounded timeouts. It never decrypts or persists the JWE and never returns remote response bodies. Both tokenization routes have an early, in-process fixed-window guard: GET allows 30 requests per TCP peer and 300 per process per 60 seconds; POST allows 10 per peer and 100 per process per 60 seconds. Excess requests return `429` and `Retry-After` before validation or remote I/O. The guard uses the socket peer address, not client-supplied forwarding headers, and caps tracked peer windows at 4,096 entries. These limits reset on process restart and do **not** coordinate across instances; behind an ALB, the peer can be the load balancer rather than the buyer. Before public AWS exposure, configure edge/distributed per-client limits and abuse monitoring with a trusted proxy/IP policy. Input validation and this local guard are not complete anti-card-testing controls. Disable caching for both tokenization routes at every proxy layer.

If `GET /checkout/consents` returns the safe public 503, backend logs emit only a redacted category: `auth`, `timeout`, `invalid_response`, `network`, or `unexpected` for unclassified internal faults. Operators can use that category to narrow configuration or connectivity checks; it does not reveal provider response bodies, keys, tokens, or card data, and it does not establish the cause of any earlier 503.

Wait for PostgreSQL to accept connections before running the migration. Migrations are explicit—runtime synchronization and automatic migration execution are disabled. The seed may be run again: fixed product IDs prevent duplicates and existing stock is not reset.

To stop and remove the disposable database:

```bash
docker stop product-payment-postgres
docker rm -v product-payment-postgres
```

`-v` also removes the container's anonymous data volume; use a named persistent volume if you need to keep local data. Never use these local credentials or this disposable setup for deployment.

## Implemented API

`GET /products` lists all available product records with current stock; `GET /products/:id` reads one. Neither route changes stock or creates a checkout. Both routes are currently unauthenticated; do not treat them as transaction-status or buyer-data endpoints.

The explicit seed adds ten deterministic demo products on a fresh database, including `8a52ea31-08d9-4f52-a604-00e56143dce0` and `3685f095-a601-4ca6-ab54-0f8eb66bccd8`. Existing rows are not reset when the seed is rerun. After updating an existing installation, rerun `npm run db:seed` to insert the eight new products. For example:

```bash
curl -i http://localhost:3000/products
curl -i http://localhost:3000/products/8a52ea31-08d9-4f52-a604-00e56143dce0
```

Successful response (`200 OK`):

```json
{
  "id": "8a52ea31-08d9-4f52-a604-00e56143dce0",
  "name": "Audífonos inalámbricos",
  "description": "Audífonos inalámbricos de diadema en color negro, con copas que rodean las orejas y un diseño sobrio para el uso diario. Pensados para escuchar música, pódcast y otros contenidos de audio sin depender de un cable.",
  "currency": "COP",
  "priceCents": 12990000,
  "stock": 12
}
```

`priceCents` is an integer in the server's currency representation; clients must not submit their own price as authoritative. Stock is a nonnegative integer. Product reads do not mutate it; confirmed approval can decrement it atomically during payment finalization.

| Result | Status | Behavior |
| --- | --- | --- |
| Existing UUID v4 | `200` | Product fields above, read from PostgreSQL. |
| Malformed or non-v4 ID | `400` | Nest validation error; persistence is not queried. |
| Well-formed but absent UUID v4 | `404` | `Product not found`. |

The generated scaffold's `GET /` also remains but is excluded from the checkout OpenAPI document. There is no product-creation, customer CRUD, or delivery CRUD endpoint. The signed-event callback is server-to-server only. A publicly hosted Swagger/OpenAPI URL and API URL remain future delivery items.

### Checkout HTTP contract

The routes below return `Cache-Control: no-store` and are described in the generated [local OpenAPI document](http://localhost:3000/api-json). Their prices, fees, references, and payment status are server-owned; no raw card details belong in API requests. The browser encrypts locally, then obtains a transient card token through fixed-path same-origin API relays before `POST /checkouts`; the API accepts only a compact JWE, not raw card fields.

| Method and path | Input | Success | Expected rejection |
| --- | --- | --- | --- |
| `GET /checkout/quote` | Query: `productId` (UUID v4), `quantity` (positive integer string). | `200` with `productId`, `quantity`, `currency`, `unitPriceCents`, `productAmountCents`, `baseFeeCents`, `deliveryFeeCents`, `totalCents`. | `400` invalid input, `404` missing product, `409` insufficient stock, `422` unsupported currency. |
| `GET /checkout/consents` | No buyer input. | `200` with sandbox `publicKey` and two current consent documents (`token`, `permalink`). | `503` if current documents cannot be read; no remote error details are exposed. |
| `GET /checkout/tokenization-key` | No buyer input. | `200` with public encryption PEM only. | `429` with `Retry-After` when locally throttled; `503` for unavailable or invalid sandbox response. |
| `POST /checkout/card-tokens` | JSON `{ "payload": "<compact JWE>" }` only; maximum 4,096 characters. | `201` with opaque `{ "token": "tok_…" }` only. | `400` for invalid shape or unexpected fields; `429` with `Retry-After` when locally throttled; `503` for unavailable or invalid sandbox response. |
| `POST /checkouts` | `Idempotency-Key` header (UUID v4) and JSON body described below. | `201` with `reference`, local `status`, and server-calculated `quote`. Same-key/same-data replay returns the original result without another submission. | `400` invalid body/header or missing consent, `404` missing product, `409` stock/idempotency conflict or `QUOTE_CHANGED`, `422` unsupported currency. |
| `GET /checkouts/status` | The original `Idempotency-Key` header (UUID v4); no query or request body. | `200` with only `reference`, local `paymentStatus`, and `fulfillmentStatus`, even if the browser lost the POST response and reference. Read-only: no provider request, repeat POST, stock update, or delivery creation. | `400` missing/malformed key, `404` unknown key. |
| `GET /transactions/:reference` | Transaction reference plus the original `Idempotency-Key` header (UUID v4). | `200` with only `reference`, local `paymentStatus`, and `fulfillmentStatus`. This read does not call the provider or mutate state. | `400` invalid reference/header, `404` unknown reference or nonmatching key. |
| `POST /payment/events` | Signed `transaction.updated` JSON with `environment: "test"`, ordered `signature.properties`, checksum, timestamp, and a signed transaction ID. | `200` only after authoritative server-side lookup and durable local handling, including safe duplicate/stale replay. | `400` malformed or unsupported event, `401` invalid checksum, `404` unknown local checkout, `409` binding/state conflict, `503` authoritative status unavailable. Unexpected storage failure is non-`200` for retry. |

The checkout JSON body has `productId` (UUID v4), `quantity` (positive integer), `expectedTotalCents` (positive safe integer from the last server quote), `installments` (buyer-selected positive safe integer for the CARD payment), `customerEmail`, `delivery` (`recipientName`, `addressLine`, `city`), transient `cardToken`, `acceptanceToken`, `personalDataToken`, and both explicit booleans `acceptsEndUserPolicy: true` and `acceptsPersonalDataAuthorization: true`. No provider-defined maximum installment count has been verified; the provider may reject an unsupported selection. The two consent tokens come from the current consent documents. Unknown body fields, including alternate client-supplied price or status, are rejected; the HTTP response omits email, delivery details, tokens, provider ID, and idempotency key. Persist the original key before submitting so a lost response can be recovered with `GET /checkouts/status`, never by inventing a new payment attempt. Both status routes use the idempotency key as a shared secret but are **not** a complete authorization design for public deployment; add buyer authentication/object-level authorization and rate limits before exposing them publicly. Keep the key out of URLs and logs.

The repository [Postman collection](../docs/product-payment.postman_collection.json) mirrors these buyer-facing routes. Its quote response script copies only `totalCents` into the `expectedTotalCents` collection variable; run that request just before checkout, since a changed total is rejected with `409 QUOTE_CHANGED`. The tokenization POST accepts only a fresh browser-generated compact JWE; its example deliberately has no plaintext card values. Card and consent tokens and the JWE are transient: enter them only in a local session, never save them to a shared environment, and clear them before exporting or syncing the collection. The signed event has no manually runnable request in the collection because a fabricated event is not a payment authority.

`PENDING` means submission acknowledgement, **not** approval. `SUBMISSION_UNKNOWN` means the external outcome is uncertain and must not trigger a blind retry. `SUBMISSION_REJECTED` is a local submission-authentication rejection. `paymentStatus: APPROVED` with `fulfillmentStatus: STOCK_UNAVAILABLE` means the charge succeeded but no delivery was created and needs operator attention. A 201 response never proves a completed purchase, stock decrement, or delivery. Controlled sandbox approvals and success-only fulfillment were observed locally; no publicly hosted endpoint has been verified.

### Bounded pending-payment recovery

The signed HTTPS payment event remains the primary confirmation path. An optional backend worker can recover aged `PENDING` checkouts that already have a locally bound provider transaction ID. It never sends a payment POST and never changes the public buyer status GET into a provider lookup. It uses the same authoritative status reader and idempotent finalizer as operator reconciliation. PostgreSQL claims at most five due rows per cycle with `FOR UPDATE SKIP LOCKED`; short leases expire after a crash, and each completed attempt receives a bounded exponential retry delay. A database transaction is **not** held while contacting the provider. Missing provider IDs and uncertain submissions are intentionally excluded: they require a verified event or separate operator investigation.

The worker is **off by default**. Set `PAYMENT_RECONCILIATION_ENABLED=true` only in an environment where the matching sandbox credentials, migrations, and provider status GET have been verified. Optional bounds: interval 5–300 seconds (default 15), batch 1–5 (default 5), minimum submission age 15–3600 seconds (default 30), lease 90–300 seconds (default 120). A public HTTPS event URL configured for the correct provider environment, an observed valid signed event, and observed bounded recovery are **production deployment gates**; local tests do not prove any of them on AWS. The worker is a fallback, not a replacement for the webhook or an object-level authorization scheme.

### Explicit reconciliation

An operator with backend runtime access and server-side credentials can recover **one** checkout whose provider transaction ID was already persisted. This is not an HTTP endpoint and never submits a new charge:

```bash
npm run build
npm run payment:reconcile -- txn_<local-uuid-v4>
```

Supply the real local reference without angle brackets. The command looks up exactly that checkout on the trusted server and refuses records without a claimed submission and bound provider ID. It does not require or expose the buyer's idempotency key in shell history or process arguments. It fetches only the locally bound ID through the private-key status reader and uses the same atomic, idempotent finalizer as signed events. It prints only the reference, payment/fulfillment states, and whether a transition was applied; nonzero exit means no successful reconciliation. Execute from a trusted server/operator environment, not a browser or public CI log. A submission **without** a stored provider ID needs a verified event or documented provider lookup, not a blind charge retry.

## Data and architecture

The first migration creates `products`: UUID primary key, name, description, three-letter uppercase currency, positive integer `price_cents`, and nonnegative integer stock. Ten deterministic demo products are inserted by the explicit seed command. A second versioned migration adds `customers` and `transactions`. The latter stores a PENDING status, unique transaction reference and idempotency key, canonical request fingerprint, quantity, product/fee/total snapshot in integer COP cents, and nullable provider-submission timestamp and provider transaction ID. A third migration adds `fulfillment_status` and `deliveries` with a unique transaction ID. Customer email and delivery details are stored with the checkout; no delivery record exists before confirmed success.

The internal `FinalizeVerifiedPayment` input accepts an **already verified, authoritative** transaction snapshot; it is not an HTTP payload parser and must not be called with untrusted event JSON. The HTTP adapter checks event shape and test environment, computes SHA256 from the event's ordered dynamic signature fields plus timestamp and the separate events secret, and requires the transaction ID among signed properties. A valid event is only a trigger: the application reads the current transaction by ID from the configured sandbox API with a bounded private-key GET. If a **signed** terminal status arrives while the authoritative read still says `PENDING`, the endpoint returns retryable `503` without finalization; an unsigned status is not trusted as a retry hint. Pure application-core finalization policy decides reference, provider ID, amount, and currency binding; monotonic payment-state transitions; and approval/fulfillment outcomes from the locked local facts. The TypeORM adapter locks the row and executes the conditional stock update and unique delivery insert in the same PostgreSQL transaction. When stock is insufficient, it records `APPROVED` with `STOCK_UNAVAILABLE` and no delivery; this is not a payment failure. Pending and rejected results leave stock and deliveries unchanged. A late or duplicate outcome cannot repeat fulfillment. A provider outage or database failure produces non-`200` so the event can be retried; the operator-only known-ID reconciliation command is available; the opt-in worker scans only aged pending attempts with a stored provider ID.

The current **demo fee policy**, not an amount prescribed by the brief, is COP 2,000 base plus COP 5,000 delivery. A separate demo policy caps one checkout at COP 20,000,000; this is an application rule, not a database rule. `QuoteCheckout` validates a UUID v4 before product lookup and computes `(unit price × quantity) + both fees` with amount-cap and stock checks. On a new checkout, `StartCheckout` recalculates the quote from the current server product and fees, then rejects an `expectedTotalCents` mismatch with `409 QUOTE_CHANGED` **before** creating a transaction or invoking payment. The client-supplied amount is a confirmation precondition, never payment authority. A same-key replay returns the original snapshot if canonical business data and the original expected total match, even when catalog price or stock has since changed; a changed expected total conflicts. The fingerprint excludes payment tokens and price for backward compatibility but includes a non-default installment selection; one installment keeps the original fingerprint. New customer and transaction rows are inserted atomically; PostgreSQL uniqueness handles competing first requests and rolls back the losing customer. A separate conditional update can durably claim provider submission once before network I/O. The `POST /checkouts` route now invokes this path. No stock is reserved or decremented when a PENDING checkout is created.

The internal `InitiatePayment` use case now checks for all three transient payment/consent tokens before creating a PENDING checkout, then atomically marks its reference `SUBMISSION_UNKNOWN` while claiming it once before invoking a `PaymentGateway` port. A sandbox-only outbound adapter supports both the official test environment and the challenge's UAT sandbox, with matching key families; it constructs the provider request from the stored server-calculated total and reference, signs it with the private integrity secret, and accepts only a matching `201`/`PENDING` response as an acknowledged submission. Acknowledgement is **not** payment approval. An authentication rejection becomes local `SUBMISSION_REJECTED`; timeout, validation response, server error, or malformed response remains `SUBMISSION_UNKNOWN` because non-submission is not proved. Outcomes and the provider ID are conditionally persisted without storing card or acceptance tokens. A retry of the same idempotency key reads the original snapshot and cannot send a second request. A process crash after the durable claim leaves `SUBMISSION_UNKNOWN` without a provider ID; this must be reconciled rather than resent. A controlled live UAT smoke test verified one `201`/`PENDING` initiation and a matching provider status read; fake-transport tests cover rejection and uncertain-outcome paths.

Plain product/quote values, payment status, and pricing rules live in `src/domain/`; use-case commands, results, `GetProduct`, `QuoteCheckout`, `StartCheckout`, and capability ports live in `src/application/`. Neither inner directory imports NestJS or TypeORM. Nest controllers in `src/adapters/inbound/http/` map HTTP input and output; TypeORM adapters in `src/adapters/outbound/persistence/` map storage records to plain values. The application-level Nest modules in `src/` bind adapters to ports; `src/adapters/outbound/persistence/database.module.ts` co-locates the Nest provider/export wiring for `DatabaseConnection` with that outbound adapter. A lazily initialized `DatabaseConnection` owns one shared connection and its shutdown. This organization makes the dependency direction visible, but the isolated core tests and adapter tests—not directory names alone—verify it. The repository-root [architecture diagrams](../README.md#1-application-architecture-implemented-locally) describe the implemented local flow and a separately labeled cloud proposal.

## Verify

Run from `backend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand --coverageReporters=text-summary
```

Most unit and HTTP E2E tests use fake ports and do not require PostgreSQL. Conditional integration tests exercise migrations and seed lifecycle, idempotency races, original-price replay, one-time submission claim, duplicate/concurrent finalization, stock depletion, and rollback on failed delivery insertion against real PostgreSQL when `CHECKOUT_TEST_DATABASE_URL` points to a database whose name ends in `_test`. The migration/seed test creates and removes a further isolated test database, so the test user needs `CREATEDB` permission. For the Compose stack, create a disposable test database from the repository root and use the password of the **running** container; the example `local-only` password above belongs only to the separate host-run alternative and can fail authentication against an existing Compose volume:

```bash
docker compose exec -T db psql -U checkout -d postgres -c 'CREATE DATABASE checkout_hito3_test'
DB_PASSWORD="$(docker compose exec -T db printenv POSTGRES_PASSWORD)"
export CHECKOUT_TEST_DATABASE_URL="postgresql://checkout:${DB_PASSWORD}@127.0.0.1:5433/checkout_hito3_test"
unset DB_PASSWORD
(cd backend && npm test -- --runInBand)
(cd backend && npm run test:e2e -- --runInBand)
(cd backend && npm run test:cov -- --runInBand --coverageReporters=text-summary)
unset CHECKOUT_TEST_DATABASE_URL
docker compose exec -T db psql -U checkout -d postgres -c 'DROP DATABASE checkout_hito3_test WITH (FORCE)'
```

Use a URL-safe local password as required in the root setup instructions; never print or commit it. Without this variable, the PostgreSQL suites are skipped rather than replaced with mocks. Coverage is measured for this backend alone; frontend Jest coverage is a separate check. Checkout HTTP E2E tests use fake payment/consent adapters, and the PostgreSQL HTTP suite uses real persistence with fake external payment I/O, not live sandbox credentials.

The PR workflow runs backend build, lint, Jest coverage, and HTTP E2E suites against an ephemeral PostgreSQL 17 service. Its test role can create the temporary database needed by the migration/seed suite. The workflow sets `CHECKOUT_TEST_DATABASE_URL` to a disposable `_test` database, so the PostgreSQL suites cannot silently skip in CI. Jest fails backend coverage unless **each** of statements, branches, functions, and lines is strictly greater than 80% (`80.01` minimum in `jest.config.ts`). This isolated CI-only database accepts trusted connections from its runner rather than storing a credential in the workflow; never use that setting for deployment. No database or coverage artifact is published. Frontend CI separately runs build, lint, and Jest coverage with the same strict four-metric threshold in `frontend/jest.config.cjs`.

On 2026-09-28 in this local worktree, with an isolated PostgreSQL test database, `CHECKOUT_TEST_DATABASE_URL=... npm run test:cov -- --runInBand --coverageReporters=text-summary` passed **154 tests in 29 suites** and measured **87.33% statements, 83.28% branches, 83.23% functions, and 87.99% lines** across `src/`, including HTTP, migration, seed, finalization, and reconciliation tests. With the same test database, `CHECKOUT_TEST_DATABASE_URL=... npm run test:e2e -- --runInBand` passed **40 HTTP E2E tests in 6 suites**. These include real PostgreSQL checks for signed-event finalization, same-key checkout races, and changed-quote rejection before any side effect; external payment I/O remains faked in these tests. The backend exceeds 80% in every measured Jest coverage metric; this does **not** establish frontend coverage or deployed callback behavior. Without the real-database variable, PostgreSQL suites are skipped and the measured percentages are lower. The successful measurement used the running Compose container's password without printing it; its disposable database was dropped afterward.

Separately on 2026-09-26, one controlled synthetic UAT smoke test used an isolated PostgreSQL database and the approved sandbox configuration. Consent retrieval and transient card tokenization succeeded; one local checkout and one provider transaction were created with matching reference and server-calculated amount. Local submission and the provider status read both returned `PENDING`. A same-key replay returned the original reference without another submission; changed purchase data with that key returned `409`; stock remained unchanged. This verifies live **initiation only**, not final approval, stock decrement, delivery, or a public deployment. No credentials or raw card data were stored in the repository.
