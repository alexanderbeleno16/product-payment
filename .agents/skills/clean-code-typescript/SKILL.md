---
name: clean-code-typescript
description: "Trigger: clean code, refactor, naming, TypeScript maintainability. Keep implementation readable without gratuitous abstraction."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use while writing or reviewing TypeScript in either application.
Read the [maintainability field guide](references/field-guide.md) for boundary-specific rules. Clean code here is a project convention, not a claim that one named book is an official standard.

## Hard Rules
- Name functions and types by business meaning; keep each unit focused on one reason to change.
- Prefer explicit types at public boundaries and inferred local types where clear; avoid `any` to bypass a design problem.
- Remove duplication only when a stable shared concept exists; do not create abstractions for one use.
- Keep comments for non-obvious intent, invariants, or tradeoffs, not narration of obvious syntax.
- Do not compress code, tests, or whitespace to satisfy a line-count target.
- Prefer explicit domain states and error variants over booleans, magic strings, or broad catches that hide behavior.
- Refactor only with behavior preserved and observed checks; architectural names are not proof of sound dependencies.

## Decision Gates
| Symptom | Response |
| --- | --- |
| Long function mixes I/O and decisions | Separate boundary work from business logic. |
| Repeated code with same meaning | Extract a named shared concept. |
| Similar code with different rules | Keep separate; explain distinction. |
| `any`, cast, or non-null assertion at a boundary | Validate/narrow input or document a justified invariant. |
| Boolean parameters obscure meaning | Use a named intent or explicit variant when behavior forks. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Name business intent, not mechanics
- R02 — Model mutually exclusive states explicitly
- R03 — Validate at external boundaries
- R04 — Keep each function at one level of reasoning
- R05 — Make error paths as clear as success paths
- R06 — Extract duplication when semantics match
- R07 — Control complexity with meaningful boundaries
- R08 — Keep dependencies directional
- R09 — Treat tests and docs as part of readability
- R10 — Refactor with evidence

## Execution Steps
1. State behavior, invariant, and boundary ownership before changing structure.
2. Name domain concepts and result states clearly; make one coherent change with tests or a baseline check.
3. Review duplication, complexity, error handling, type safety, and dependency direction, not only formatting.
4. Re-run relevant build/lint/tests and explain what became easier to understand or change.

## Output Contract
Report the original maintenance risk, the revised contract/boundary, behavior-preserving evidence, and remaining tradeoffs.

## References
Read the local [maintainability field guide](references/field-guide.md) with TypeScript sources; the [shared source map](../_shared/sources.md) covers framework boundaries.
