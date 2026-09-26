---
name: railway-oriented-use-cases
description: "Trigger: Railway Oriented Programming, ROP, Result, typed error, use-case failure. Compose success and failure paths explicitly."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use for use cases with validation, stock checks, pending transactions, external outcomes, or other expected failures.
Read the [ROP field guide](references/field-guide.md) before introducing a Result type or chaining helpers; the goal is explicit failure semantics, not a new library.

## Hard Rules
- Represent expected outcomes with an explicit typed success/failure result; do not turn normal business rejection into an untyped exception.
- Compose steps so a failure short-circuits later success-only actions.
- Model external errors separately from domain errors and translate them at boundaries.
- Never decrement stock or create delivery on failed payment; do not infer success from a pending transaction.
- Do not add a functional-programming library solely to imitate ROP; prefer the simplest readable TypeScript shape.
- Preserve the difference between a business rejection, a transport failure, and an outcome that is still unknown; never collapse them into one `false` value.
- Design idempotent retries and compensating/recovery behavior before sequencing irreversible effects.

## Decision Gates
| Outcome | Handling |
| --- | --- |
| Expected validation/business failure | Typed failure result. |
| Unexpected infrastructure fault | Preserve cause, log safely at boundary, map to safe response. |
| Successful confirmed payment | Continue permitted stock/delivery steps. |
| Pending or unknown external status | Stop success-only effects, retain reference, and re-query authoritative status. |
| Partial side effect | Report/recover explicitly; a Result wrapper is not a transaction. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Define a narrow Result contract
- R02 — Validate before effects
- R03 — Compose success-only steps
- R04 — Treat pending as a first-class outcome
- R05 — Separate expected errors from unexpected faults
- R06 — Design retries and idempotency
- R07 — Admit partial failure
- R08 — Keep boundary mappings outside the core
- R09 — Keep the code readable
- R10 — Test the negative paths as invariants

## Execution Steps
1. Enumerate success, rejection, pending/unknown, fault, duplicate, and partial-completion outcomes.
2. Define narrow Result/error variants at domain/application boundaries and translate infrastructure failures at adapters.
3. Compose pure checks before effects; guard each irreversible step with authoritative status and idempotency policy.
4. Test short-circuits, retries, and partial failure; verify forbidden stock/delivery effects did not occur.

## Output Contract
Report result variants, step order, unknown/partial-state handling, retry policy, and tests that prove prevented side effects.

## References
Read the local [ROP field guide](references/field-guide.md) and its original source, plus the [shared source map](../_shared/sources.md).
