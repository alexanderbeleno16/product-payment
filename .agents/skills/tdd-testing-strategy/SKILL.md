---
name: tdd-testing-strategy
description: "Trigger: TDD, red green refactor, testing strategy, test plan. Choose proportionate tests and require observed cycles only when TDD is enabled."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when planning tests for a behavior change or when a task explicitly calls for test-driven development.
Read the [testing-strategy field guide](references/field-guide.md) to choose observable cases and test layers; this skill does not turn TDD on automatically.

## Hard Rules
- Resolve whether TDD is enabled from an explicit user choice or existing project/session configuration; the presence of Jest alone does not enable it.
- When enabled, observe a failing test before implementation, then green, then refactor. Never invent red/green evidence.
- When disabled or unknown, still write and run behavior tests; do not claim a TDD cycle.
- Balance pure use-case tests, boundary/integration tests, and a few critical end-to-end journeys.
- Cover failure and rollback conditions for payment and stock flows, not only happy paths.
- Treat coverage as an outcome metric, not a substitute for meaningful edge, integration, and negative-path tests.
- Keep test data, isolation, and exact runner evidence reproducible; do not describe an unobserved RED/GREEN cycle.

## Decision Gates
| Mode | Action |
| --- | --- |
| Explicitly enabled | RED → GREEN → REFACTOR with recorded commands/results. |
| Disabled | Implement with ordinary focused and full verification. |
| Unknown | State uncertainty; do not label work TDD. |
| Existing runner missing | Resolve runner setup before claiming a test-first cycle; disclose the gap. |
| Boundary behavior at risk | Add contract/integration proof in addition to pure-unit coverage. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Start from one observable behavior
- R02 — Make RED genuine and informative
- R03 — GREEN is the smallest correct behavior
- R04 — REFACTOR preserves behavior
- R05 — Build a risk-based test matrix
- R06 — Choose the lowest layer that answers the question
- R07 — Test negative and partial outcomes
- R08 — Keep tests deterministic and isolated
- R09 — Measure coverage honestly
- R10 — Report constraints and unavailable checks

## Execution Steps
1. Resolve TDD mode/source and the exact runner for the target app; do not infer mode from Jest's presence.
2. Convert acceptance criteria into success, rejection, pending, duplicate, and recovery examples.
3. Choose the lowest useful layer plus a boundary proof where integration could fail.
4. If enabled, record actual RED → minimal GREEN → REFACTOR; otherwise run ordinary focused/full checks.
5. Measure coverage where available and report gaps, flakiness, skipped tests, and untested infrastructure assumptions.

## Output Contract
Report mode/source, runner, test matrix, observed cycle or ordinary checks, coverage evidence, and residual risk.

## References
Read the local [testing-strategy field guide](references/field-guide.md), the Jest skill, and the [shared source map](../_shared/sources.md).
