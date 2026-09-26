# README and technical-documentation field guide

The repository README is a reviewer interface. It must describe the system that exists at the referenced commit, not the system intended by the task brief. Place detailed API or architecture material in linked docs when the README becomes hard to scan.

## Reviewer questions to answer

| Reader asks | Evidence to provide when available |
| --- | --- |
| What is this? | One-paragraph product flow and repository layout. |
| How do I run it? | Prerequisites, exact install/start commands, config names without values. |
| How does checkout work? | Screen/API sequence, pending/failure/retry semantics, authority boundaries. |
| How is data stored? | Data model diagram/table, seeded products, constraints and stock update policy. |
| How is it tested? | Commands, Jest results and separate coverage for frontend/backend. |
| Where can I inspect it? | Verified public frontend/API URLs and public API docs/collection. |

### R01 — Lead with verified current behavior

State the working scaffold or implemented feature set plainly. If checkout is not yet built, do not write as if payment, stock, database, or deploy already works. Use a short "Current status" and "Planned" distinction when necessary.

### R02 — Make setup reproducible

List Node/npm versions actually required, install commands for `frontend/` and `backend/`, local start commands, ports, and safe environment variable **names**. Explain how to obtain test credentials without publishing values. Verify every command from a clean checkout or state the limitation.

### R03 — Explain architecture by dependency direction

Show a small diagram or table: React UI, Nest HTTP adapter, use cases/domain, outbound ports, persistence/remote adapters. Explain why business rules are outside controllers and what can be tested without I/O. A folder tree alone does not prove hexagonal architecture.

### R04 — Document the data model after it exists

Include entities/relationships, keys, required fields, product seed strategy, money/currency representation, quantity and stock constraints, and transaction/delivery lifecycle. State which operations are atomic and which need reconciliation. Do not choose PostgreSQL, DynamoDB, or an ORM in prose before an actual decision.

### R05 — Describe public API contracts concretely

For implemented endpoints, show method/path, request/response schema, validation, status/error cases, and authentication/access policy. Link a public Swagger or Postman collection only after its URL works. A promised link or ungenerated collection is not a deliverable.

### R06 — Show the checkout state model

Explain editing, submitting, pending/unknown, confirmed, and failed states, plus retry and refresh behavior. State that the server owns product price/stock and final transaction status. Document why card fields are not restored after refresh while safe progress may be retained.

### R07 — Report testing without inflation

Include exact build/lint/Jest commands and observed counts. Measure coverage separately for frontend and backend; report statements, branches, functions, and lines with date/commit, scope, and exclusions. The brief requires **more than 80%** in both. Do not substitute a passing backend scaffold test for frontend coverage.

### R08 — Treat deployment as evidence

When deployed, give verified public frontend and API URLs, hosting topology, TLS/header owner, required config names, and a smoke-test path. A local container or successful build is not a deployed application. Do not invent cloud resources or costs.

### R09 — Record security assumptions and residual risk

Explain secret boundaries, sensitive-card handling, validation, authorization model, idempotency/retry policy, and observed HTTPS/security headers. Label recommendations not yet implemented. Avoid claims like "OWASP compliant" without concrete tested controls.

### R10 — Maintain the document with each work unit

Update README/API docs alongside changed behavior. Check relative links, screenshots, commands, URLs, coverage, and forbidden names before each commit. Prefer short task-oriented sections and links to deeper docs over a single dense wall of text.

## Suggested README outline

1. Purpose and current status.
2. Repository map and prerequisites.
3. Local setup for frontend/backend.
4. Checkout flow and architecture diagram.
5. API contract/public API docs link (when verified).
6. Data model and seed process (when implemented).
7. Testing commands and measured coverage.
8. Deployment URL and configuration (when verified).
9. Security decisions, limitations, and tradeoffs.

## Review checklist

- Can a new reviewer run the exact current commit from the documented commands?
- Are API, data-model, coverage, and deployment claims backed by working artifacts?
- Are planned features visibly separate from implemented behavior?
- Are secrets, card data, and prohibited branding absent?
- Does the document explain failure/recovery behavior and not only the happy path?
- Were links and public URLs actually opened or tested?

## Sources and status

- The supplied technical brief defines required README, data-model, API, test, and deployment deliverables; it is intentionally not copied into this public repository.
- [Nest OpenAPI introduction](https://docs.nestjs.com/openapi/introduction) — use only if OpenAPI is actually adopted.
- [Jest configuration and coverage](https://jestjs.io/docs/configuration)
- The outline and evidence rules above are project documentation conventions, not an external standard.
