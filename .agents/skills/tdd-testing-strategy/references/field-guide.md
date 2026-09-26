# TDD and testing-strategy field guide

Test-driven development is a workflow choice, not a synonym for having tests. Resolve whether the project/user explicitly enabled it and which exact runner will execute the next behavior test. This guide helps select cases and layers whether TDD is on or off.

## Mode decision

| Effective mode | Required behavior | Claim allowed |
| --- | --- | --- |
| Enabled by explicit setting/choice | Observe a failing test before production change, then green, then refactor. | TDD cycle only with command/result evidence. |
| Disabled | Implement with proportionate focused and full tests. | Tested, not TDD. |
| Unknown/conflicting | State uncertainty and resolve it before claiming TDD. | No invented mode. |
| Runner missing | Configure/verify runner when authorized or report missing capability. | No fabricated RED/GREEN. |

### R01 — Start from one observable behavior

Write a case in domain terms: given trusted product price and quantity, when a confirmed transaction is processed, expected stock/delivery effects occur once. State what must **not** happen on rejection or pending. A test about a private helper is not a substitute for a behavior contract.

### R02 — Make RED genuine and informative

With TDD enabled, run the exact focused test and observe the expected failure for the behavior, not a syntax/configuration error. Record command and a concise failure reason. If the test passes before the change, it did not prove the missing behavior; strengthen the assertion or case.

### R03 — GREEN is the smallest correct behavior

Implement only enough to satisfy the behavior without breaking adjacent invariants. Run the focused test, then relevant neighboring tests. A green test with the use case mocked or a trivial assertion is not evidence of the intended behavior.

### R04 — REFACTOR preserves behavior

Improve names, duplication, and boundaries only after green, then rerun tests. Do not combine a new feature with a cleanup step and label it a refactor. Keep evidence of the final state, not merely the momentary green result.

### R05 — Build a risk-based test matrix

For checkout, include input validation, quantity boundaries, trusted price, duplicate request, failed and pending payment, status reconciliation, stock race, delivery creation, refresh recovery, and unsafe data retention. Prioritize irreversible side effects and authority boundaries over superficial getters.

### R06 — Choose the lowest layer that answers the question

Use pure-unit tests for domain decisions, React component tests for observable interaction, adapter tests for serialization/protocol, and a few Nest E2E tests for route/DI/validation wiring. A pure unit test cannot prove CORS or HTTP status mapping; an E2E test is too slow and opaque for every domain branch.

### R07 — Test negative and partial outcomes

Assert absence of forbidden calls and state changes after failure or pending status. Add cases for external timeout and a confirmed payment followed by failed local persistence; identify the recovery policy rather than asserting a fictional rollback of a remote charge.

### R08 — Keep tests deterministic and isolated

Control clock, random IDs, network responses, and storage at their ports. Reset fixtures/mocks. Avoid sleeping, real external credentials, or order-dependent global state. Use meaningful fake values that cannot be mistaken for live secrets.

### R09 — Measure coverage honestly

The brief requires more than 80% coverage for both apps with Jest. Measure separately and inspect branches in critical use cases. Do not replace missing behaviors with broad exclusions or celebrate a single percentage without explaining what it covers. Coverage informs the next test; it does not certify correctness.

### R10 — Report constraints and unavailable checks

Record which tests ran, exact commands, failures, skips, flaky behavior, and environmental gaps. The current frontend scaffold lacks Jest; until installed and verified, frontend coverage is unavailable. Do not imply backend tests satisfy a frontend requirement.

## Example acceptance matrix

| Scenario | Unit | Component | E2E/adapter |
| --- | --- | --- | --- |
| Invalid quantity | Domain rejection | Field error | HTTP validation. |
| Pending status | No stock/delivery effect | Pending announcement | Status mapping. |
| Duplicate submit | Idempotent use case | Button state | Same transaction identity. |
| Refresh | Reconcile safe reference | No card fields restored | Authoritative status query. |

## Review checklist

- Is TDD mode resolved from evidence rather than inferred from a test framework?
- Was RED a behavior failure, GREEN observed, and REFACTOR rechecked?
- Does the test matrix cover irreversible effects and negative cases?
- Are unit, component, adapter, and E2E responsibilities distinct?
- Are runner commands and coverage per app reported honestly?

## Primary sources

- [Jest getting started](https://jestjs.io/docs/getting-started)
- [Jest configuration and coverage](https://jestjs.io/docs/configuration)
- [Nest testing](https://docs.nestjs.com/fundamentals/testing)
- [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/)
- The RED/GREEN/REFACTOR sequence and layer choices above are project workflow conventions, not a feature enabled by Jest itself.
