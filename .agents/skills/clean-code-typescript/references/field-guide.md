# TypeScript maintainability field guide

This is a project convention for code reviewers and AI agents, not a universal clean-code certification. Prefer code that makes checkout behavior, dependency direction, and failure states easy to audit. A formatter or linter is evidence about syntax/style, not domain clarity.

## Priority map

| Priority | Concern | Smell |
| --- | --- | --- |
| High | Explicit contracts and states | Booleans/magic strings permit contradictory outcomes. |
| High | Boundary ownership | Controllers and components decide business rules. |
| Medium | Type safety and errors | `any`, broad catches, unsafe casts hide assumptions. |
| Medium | Focus and duplication | One function owns many unrelated reasons to change. |
| Measured | Refactor value | Abstractions added without reducing change cost. |

### R01 — Name business intent, not mechanics

Prefer `confirmPaymentStatus` or `reserveRequestedQuantity` over `handleData`. Name a boolean by the proposition it represents, and avoid negative double-checks. A name is a contract: if behavior changes, change the name or split the responsibility.

### R02 — Model mutually exclusive states explicitly

Use a discriminated union for `pending | confirmed | failed` rather than independent flags that can all be true. Exhaustive `switch` handling can make a new variant visible to TypeScript. Avoid enums or generic status strings when a narrow literal union communicates the allowed domain states better.

### R03 — Validate at external boundaries

The compiler cannot validate runtime JSON or storage data. Narrow `unknown` through parsing/validation before it enters trusted domain code. Do not replace evidence with `as SomeType`, `!`, or `any` merely to satisfy compilation. Record why a cast is safe if one is unavoidable.

### R04 — Keep each function at one level of reasoning

A use case may coordinate named domain steps, while a parser handles one data format. Avoid mixing HTTP serialization, stock decisions, persistence, and UI text in one function. A long function is not automatically wrong; the problem is multiple independent reasons to change or hidden side effects.

### R05 — Make error paths as clear as success paths

Use typed expected failures where business rejection is normal. Do not catch an exception only to return `undefined` or `false`, losing the cause. Keep raw infrastructure details inside adapters; expose safe, stable application variants. Log only at a deliberate boundary to avoid duplicate or sensitive logs.

### R06 — Extract duplication when semantics match

Two similar lines are not sufficient reason to abstract. Extract when the same invariant is duplicated and must change together. Keep superficially similar but different business rules separate. Avoid a generic helper whose options recreate every original branch.

### R07 — Control complexity with meaningful boundaries

Prefer early returns for invalid preconditions when they clarify the main path. Use small named operations for complex decisions, but do not fragment a simple sequence into dozens of one-line wrappers. Review nesting, hidden mutation, and temporal coupling rather than counting lines alone.

### R08 — Keep dependencies directional

Domain/use-case code should not import Nest, browser globals, ORM models, or remote SDK types. Adapt at the edge. Avoid circular imports and barrels that make dependency direction hard to inspect. See the hexagonal skill for the architectural boundary.

### R09 — Treat tests and docs as part of readability

Tests should state behavior and invariant, not mirror private implementation. A concise explanation of a non-obvious policy can be more valuable than a clever abstraction. Comments explain why a decision exists, not what the next line obviously does.

### R10 — Refactor with evidence

Before restructuring, identify current behavior and run focused checks. Afterward, prove the same behavior and inspect the diff for accidental feature changes. Do not claim a design is cleaner solely because files moved or classes gained interface names.

## Review checklist

- Can a reviewer describe the business action from names and types alone?
- Are runtime inputs validated before assertions or domain decisions?
- Are expected failures explicit and unexpected faults still diagnosable?
- Did an abstraction remove a real duplication or merely add navigation?
- Can the core be reasoned about without framework and I/O details?
- Were behavior-preserving checks observed after refactoring?

## Primary sources and status

- [TypeScript: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [Alistair Cockburn: Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- The naming, abstraction, and refactor rules above are **project conventions** informed by these sources, not direct TypeScript specification requirements.
