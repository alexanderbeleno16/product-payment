---
name: hexagonal-ports-adapters
description: "Trigger: hexagonal architecture, ports and adapters, use case, domain boundary. Keep business logic independent of framework and I/O."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when designing application use cases or integrating HTTP, persistence, and external services.
Read the [hexagonal field guide](references/field-guide.md) before drawing modules or ports; it distinguishes architectural boundaries from a premature folder template.

## Hard Rules
- Point dependencies inward: domain and use cases must not import Nest, database clients, or remote SDKs.
- Define a port only at a real boundary needed by a use case; avoid one-interface-per-class ceremony.
- Driving adapters translate inbound protocols; driven adapters implement outbound ports.
- Keep the application testable without a UI, database, or network.
- Do not lock in a database, ORM, or deployment topology in this methodology skill.
- Name ports by business capability and keep adapters replaceable; never expose transport DTOs, ORM entities, or SDK response types through core contracts.
- Define consistency and retry responsibilities when a use case spans payment, stock, and delivery; interfaces alone do not make effects atomic.

## Decision Gates
| Change | Placement |
| --- | --- |
| Business invariant or decision | Domain/use case. |
| HTTP request/response mapping | Driving adapter. |
| Storage or external service call | Driven adapter. |
| Framework provider registration | Composition root/outer adapter. |
| Cross-resource consistency | Use-case policy plus explicit persistence/transaction capability; document unresolved distributed guarantees. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Start with a use case and invariant
- R02 — Separate input and output ports
- R03 — Keep contracts core-owned
- R04 — Avoid ceremonial ports
- R05 — Keep Nest at the edge
- R06 — Define consistency, not just interfaces
- R07 — Separate expected outcomes from faults
- R08 — Test ports and adapters differently
- R09 — Review dependency direction mechanically

## Execution Steps
1. Write the business invariant and a dependency map before choosing directories or framework modules.
2. Define input/output contracts and only the outbound capabilities the use case needs.
3. Build core behavior against ports; write transport/persistence/external adapters and composition wiring outside the core.
4. Test the core with fakes, each adapter contract with real boundary assumptions, and final wiring with an integration/E2E check.

## Output Contract
Report the dependency map, port rationale, adapter responsibilities, consistency assumptions, and evidence that the core runs without external systems.

## References
Read the local [hexagonal field guide](references/field-guide.md), Cockburn's original article, and the [shared source map](../_shared/sources.md).
