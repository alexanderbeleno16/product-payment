---
name: jest-frontend-backend
description: "Trigger: Jest, unit test, frontend test, backend test, coverage, E2E. Verify behavior in both applications and report honest coverage."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when adding or running tests, mocks, coverage, or Jest configuration in either application.
Read the [Jest testing field guide](references/field-guide.md) for layer choice, configured frontend runner, mocking boundaries, and coverage evidence.

## Hard Rules
- Use Jest in both applications. The frontend runner is configured in `frontend/jest.config.cjs` with SWC, jsdom, and Testing Library; verify it with `cd frontend && npm run test:coverage -- --runInBand`. The backend runner is configured separately.
- Test observable behavior and failure paths; avoid coupling tests to implementation details.
- Mock external I/O at clear ports, not core business behavior under test.
- Measure coverage separately for frontend and backend; the brief requires **more than 80%**, not merely 80%.
- Do not report coverage from a passing test count alone; include the exact command and measured result.
- Do not use global coverage exclusions to make a percentage pass; show statements, branches, functions, and lines per application and explain any justified exclusions.
- Test side-effect prevention on failed/pending payment and stock/delivery paths, not only return values.

## Decision Gates
| Boundary | Test |
| --- | --- |
| Pure domain/use case | Focused unit test. |
| React interaction | User-visible DOM test. |
| HTTP wiring and response | Nest E2E/integration test. |
| Persistence/external adapter | Adapter contract/integration test, isolated from domain-unit tests. |
| Coverage claim | Run each app's configured coverage command and report actual metrics/scope. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Derive tests from acceptance behavior
- R02 — Keep domain tests independent
- R03 — Test React through the DOM
- R04 — Configure frontend Jest explicitly
- R05 — Use Nest E2E for wiring
- R06 — Mock at true boundaries
- R07 — Make time and network deterministic
- R08 — Treat coverage as scoped evidence
- R09 — Prove negative invariants
- R10 — Keep test data safe and meaningful
- R11 — Report exact execution

## Execution Steps
1. Map acceptance cases and choose unit, component, adapter, or E2E evidence for each.
2. Verify each app's configured environment and transform; use a Node environment only for tests that require real cryptography rather than DOM behavior.
3. Add behavior tests and mocks at external ports, including negative assertions for forbidden effects.
4. Run focused suites, full suites, and coverage with exact commands; inspect branch gaps and uncovered critical paths.

## Output Contract
Report commands, suite/test counts, environment/mocks, all per-app coverage metrics when measured, exclusions, and unresolved critical gaps.

## References
Read the local [Jest testing field guide](references/field-guide.md) and official Jest/Nest/Testing Library links; see the [shared source map](../_shared/sources.md).
