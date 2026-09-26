# Project agent instructions

## Scope and stack

- This repository contains a React + TypeScript SPA in `frontend/` and a NestJS + TypeScript API in `backend/`.
- Keep project skills only in `.agents/skills/<skill-name>/SKILL.md`. Use `.atl/skill-registry.md` as an index; each `SKILL.md` is authoritative.
- Load only skills matching the current task. Do not copy project skills into a user or global directory.
- Treat the payment-provider integration, database-engine selection, and AWS deployment as later decisions, not established implementations. TypeORM is the chosen ORM direction for guidance but is not installed or integrated yet.
- Refer to the payment provider as **Empresa innombrable** in every tracked or published artifact. A local-only skill may use the original documentation, but its entire directory is Git-ignored and must never be staged or published.

## Project skill routing

Select by the work being done, then read the entire linked `SKILL.md` **and its local field guide**. The registry is a discovery index, not a substitute for the skill content.

| Work | Skills |
| --- | --- |
| React components, state, effects, performance | [react-spa-best-practices](.agents/skills/react-spa-best-practices/SKILL.md) |
| Shared checkout state and Flux flow | [redux-toolkit-flux](.agents/skills/redux-toolkit-flux/SKILL.md) |
| Mobile flow and viewport/browser QA | [responsive-mobile-first](.agents/skills/responsive-mobile-first/SKILL.md) |
| Layout primitives | [css-grid-flexbox](.agents/skills/css-grid-flexbox/SKILL.md) |
| Semantics, keyboard, focus, dialogs | [accessibility-ui](.agents/skills/accessibility-ui/SKILL.md) |
| HTTP routes, providers, DTOs | [nestjs-best-practices](.agents/skills/nestjs-best-practices/SKILL.md) |
| ORM entities, migrations, repositories, seeds, transactions | [typeorm-persistence](.agents/skills/typeorm-persistence/SKILL.md) |
| Domain/application boundaries | [hexagonal-ports-adapters](.agents/skills/hexagonal-ports-adapters/SKILL.md) |
| Typed failures and use-case flow | [railway-oriented-use-cases](.agents/skills/railway-oriented-use-cases/SKILL.md) |
| Maintainable TypeScript | [clean-code-typescript](.agents/skills/clean-code-typescript/SKILL.md) |
| Jest and per-app coverage | [jest-frontend-backend](.agents/skills/jest-frontend-backend/SKILL.md) |
| Test design and TDD mode | [tdd-testing-strategy](.agents/skills/tdd-testing-strategy/SKILL.md) |
| Web/API threats and negative tests | [owasp-web-api](.agents/skills/owasp-web-api/SKILL.md) |
| TLS, CSP, HSTS, headers | [https-security-headers](.agents/skills/https-security-headers/SKILL.md) |
| Images, builds, Compose, secrets | [docker-containers](.agents/skills/docker-containers/SKILL.md) |
| README, API/data-model/deploy evidence | [readme-technical-documentation](.agents/skills/readme-technical-documentation/SKILL.md) |

If the local-only `.agents/skills/empresa-innombrable/SKILL.md` exists, load it for payment-provider documentation questions or integration work. It and its unchanged source documents are intentionally Git-ignored, so this optional route is unavailable on a fresh clone. Never copy their original names, text, URLs, or brand into tracked artifacts.

## Product and security invariants

- Keep the payment provider's brand name out of all tracked and published repository artifacts, including paths, documentation, comments, and commit messages. Use **Empresa innombrable** instead. Original documentation may exist only in the Git-ignored local skill.
- Never persist card number, cardholder name, expiry, or security code across refreshes. Never log or commit secrets or card data.
- A failed payment must not decrement stock or create a delivery. Allow the buyer to choose quantity; update stock only after confirmed success.
- Keep business decisions out of HTTP controllers; use cases and domain code must remain independent of Nest and external services.

## Verification and delivery

- Use Jest for frontend and backend tests. The test brief requires more than 80% coverage in each; do not claim this until measured on both projects.
- For current scaffolds, run `npm run build && npm run lint` in both folders; run `npm test -- --runInBand && npm run test:e2e -- --runInBand` in `backend/`.
- Use Conventional Commits with no AI attribution. Commit one reviewable work unit with its tests and documentation.
- Do not push or publish without explicit authorization for that remote operation.

## Source-backed guidance

- Before technology, security, or architecture work, read the matching local skill and its source map at `.agents/skills/_shared/sources.md`.
- Verify changing APIs against the installed version and current primary documentation; a skill is guidance, not evidence that a feature exists.
