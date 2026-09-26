---
name: redux-toolkit-flux
description: "Trigger: Redux Toolkit, RTK, Flux, checkout state, slices, selectors. Model predictable one-way state changes in the React SPA."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when shared frontend state, checkout progression, actions, reducers, or persistence are involved.
Load the matching sections of the [Redux/Flux field guide](references/field-guide.md) before designing store shape, asynchronous work, or refresh recovery. Redux Toolkit is a chosen future implementation requirement, not a dependency already present in the scaffold.

## Hard Rules
- Use Redux Toolkit's `configureStore` and feature-focused `createSlice`; keep the action → reducer → state → UI flow explicit.
- Reducers remain deterministic. Place network calls and other effects outside reducers.
- Infer store types from the configured store and use typed accessors; select only needed state.
- Never place card number, cardholder name, expiry, or security code in persisted Redux state. Do not log them through actions or DevTools.
- Persist only non-sensitive progress needed for refresh recovery, with a versioned and validated shape.
- Model transaction state as a finite progression and reconcile it with the API; never advance from pending to success on client inference alone.
- Separate client interaction state from server-owned product/stock/payment data and from sensitive form fields.

## Decision Gates
| State | Choice |
| --- | --- |
| Local visual interaction | Component state. |
| Shared checkout progress | Redux slice. |
| Server-authoritative payment or stock result | Fetch/refresh from API; never invent success in a reducer. |
| Async request cache and invalidation needed | Evaluate RTK Query against a small explicit thunk; choose one deliberately. |
| Refresh recovery needed | Persist only an allowlisted, versioned subset; reject unknown or obsolete shapes. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Classify each field before storing it
- R02 — Make transitions explicit
- R03 — Keep slices feature-focused
- R04 — Keep reducers pure even with Immer
- R05 — Type boundaries from the store
- R06 — Choose one async strategy deliberately
- R07 — Persist only an allowlist
- R08 — Reconcile after refresh or retry
- R09 — Test transitions and failures

## Execution Steps
1. Classify each field by owner and sensitivity; draw the checkout transition table before writing slices.
2. Configure one store and feature slices; infer typed dispatch/state/hooks and expose focused selectors.
3. Place I/O in an explicit async boundary, distinguish pending from final outcomes, and make duplicate responses safe.
4. Persist only an allowlist with versioning and validation; never persist card fields or raw error bodies.
5. Test reducer transitions, selectors, asynchronous behavior, migration/refresh, and action/persistence redaction.

## Output Contract
Report state ownership, transition graph, async mechanism, persistence allowlist, tests, and any unresolved reconciliation risk.

## References
Read the local [Redux/Flux field guide](references/field-guide.md) and its official Redux/React sources; the [shared source map](../_shared/sources.md) is a secondary index.
