---
name: nestjs-best-practices
description: "Trigger: NestJS, controller, provider, module, DTO, API endpoint. Build thin HTTP adapters with explicit validation and dependency injection."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use for Nest module wiring, HTTP routes, providers, request validation, and API behavior in `backend/`.
Read the relevant rules in the [Nest API field guide](references/field-guide.md); verify installed `@nestjs/*` versions before adopting newly documented APIs.

## Hard Rules
- Controllers translate HTTP input and output; delegate business decisions to application use cases.
- Bind dependencies through Nest modules/providers at the edge; keep domain code free of Nest imports.
- Validate untrusted input at the boundary, including quantity, identifiers, and expected payload shape.
- Choose HTTP methods/status codes by semantics; return safe, explicit errors without leaking internals.
- Do not choose a database, ORM, or payment integration by assumption; those decisions are deferred.
- Define the public request/response contract and negative cases before decorators or DTOs; document only endpoints that are actually implemented.
- Keep validation, authorization, and business invariants distinct: a valid DTO is not proof that a transaction is permitted.

## Decision Gates
| Responsibility | Location |
| --- | --- |
| Route, DTO, response mapping | Controller/HTTP adapter. |
| Business rule or transaction workflow | Application/domain. |
| External API or persistence | Driven adapter behind a port. |
| Business rejection | Typed use-case failure, mapped to an appropriate HTTP status by the adapter. |
| Unexpected fault | Safe response plus structured, redacted diagnostics at the boundary. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Specify the HTTP contract first
- R02 — Validate untrusted boundaries
- R03 — Keep controllers as adapters
- R04 — Bind abstractions at the composition root
- R05 — Map failures intentionally
- R06 — Handle request lifecycle deliberately
- R07 — Treat configuration as an external dependency
- R08 — Make repeated requests safe
- R09 — Test the right layer
- R10 — Check version-sensitive examples

## Execution Steps
1. Specify method/path, request and response shapes, status/error mapping, and idempotency expectations.
2. Validate untrusted input at the HTTP boundary and inject use-case/port bindings through modules.
3. Keep controller orchestration thin and map typed outcomes to safe HTTP responses.
4. Verify the actual Nest version and middleware/pipe configuration, then test validation, success, failure, and provider wiring.

## Output Contract
Report the route contract, DTO/validation policy, dependency bindings, status/error mapping, version-sensitive choices, and unit/E2E evidence.

## References
Read the local [Nest API field guide](references/field-guide.md) and its official Nest sources; the [shared source map](../_shared/sources.md) is the cross-skill index.
