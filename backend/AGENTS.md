# Backend agent instructions

These instructions apply to `backend/` and its descendants. Inherit the repository-root `AGENTS.md`; this file adds Nest API-specific guidance rather than replacing it.

## Current baseline

- The application uses NestJS + TypeScript with CommonJS output and Jest. PostgreSQL and TypeORM back the read-only product endpoint through an application-owned port; payment integration and deployment adapters are not implemented.
- Keep the product-read boundary intact and do not present planned checkout behavior as implemented. Verify installed Nest and TypeORM versions before adopting version-sensitive APIs.

## Working rules

- Read the task-matching project skill and its `references/field-guide.md` before implementing or reviewing that topic. The main starting points are [Nest](../.agents/skills/nestjs-best-practices/SKILL.md), [TypeORM persistence](../.agents/skills/typeorm-persistence/SKILL.md), [hexagonal architecture](../.agents/skills/hexagonal-ports-adapters/SKILL.md), [typed use-case failures](../.agents/skills/railway-oriented-use-cases/SKILL.md), [Jest](../.agents/skills/jest-frontend-backend/SKILL.md), and [API security](../.agents/skills/owasp-web-api/SKILL.md).
- Keep controllers as HTTP adapters: validate and map requests/responses there, but keep business rules in framework-independent application/domain code. Bind outbound ports to concrete adapters at the composition root.
- Do not trust client-supplied price, stock, or payment success. Validate quantity and other untrusted input at the boundary; calculate authoritative totals on the server.
- Model confirmed success, rejection, pending/unknown, and infrastructure faults distinctly. A failed or unconfirmed payment must not decrement stock or create a delivery; repeated requests must not duplicate a successful effect.
- Keep credentials and provider secrets on the server. Do not log sensitive card data or secrets; map expected failures to safe responses and redact unexpected faults.
- Define route contracts, failure mapping, transaction boundaries, and retry/idempotency behavior before implementing checkout endpoints. Do not invent endpoint names or persistence guarantees from the scaffold.

## Verification

- From `backend/`, run `npm run build`, `npm run lint`, `npm test -- --runInBand`, and `npm run test:e2e -- --runInBand` for applicable changes.
- Add focused unit and E2E tests for success, validation, rejection, pending/unknown, retries, and side-effect boundaries as those behaviors are implemented. Use `npm run test:cov` to measure coverage; do not claim the required threshold until observed.
