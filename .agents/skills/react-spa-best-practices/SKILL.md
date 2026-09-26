---
name: react-spa-best-practices
description: "Trigger: React SPA, Vite component, hooks, state, effects, rendering. Build maintainable React and TypeScript UI without Next.js assumptions."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use for React component design, state placement, effects, rendering, or performance work in `frontend/`.
Before changing code, read the relevant rule group in [the React field guide](references/field-guide.md): state/component boundaries, effects/data flow, forms, or performance. This is a client-rendered Vite SPA, not a server-rendered framework.

## Hard Rules
- Keep rendering pure. Derive values from props or state instead of storing duplicate state.
- Put user-triggered work in event handlers; use Effects only to synchronize with external systems, and clean them up.
- Keep sensitive card fields ephemeral; do not restore them from storage or add them to logs.
- Do not apply Next.js server-component, route-handler, or hydration rules to this Vite SPA.
- Optimize only after identifying the actual render, bundle, or network cost; avoid reflexive memoization.
- Keep product images appropriately sized and compressed; verify their rendered bounds and loading cost rather than assuming a fast image from a small component bundle.
- Treat product price, stock, and payment outcome returned by the API as server-authoritative. A visual optimistic state is not proof of payment.
- Handle loading, empty, error, retry, and duplicate-submit states explicitly; preserve non-sensitive checkout progress without persisting card fields.

## Decision Gates
| Need | Choice |
| --- | --- |
| State used by one small subtree | Keep it local or lift it to the nearest common parent. |
| State shared across checkout screens | Use the project Redux skill. |
| Heavy optional UI | Consider lazy loading after checking bundle impact. |
| Value derived from current inputs | Compute during render or in a selector; do not synchronize duplicate state with an Effect. |
| Network request tied to screen state | Centralize cancellation/stale-response handling; never let an old response overwrite a newer flow. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Model states rather than a collection of booleans
- R02 — Derive instead of synchronizing
- R03 — Place state at the narrowest useful owner
- R04 — Define component contracts around responsibility
- R05 — Put user actions in handlers; reserve Effects for synchronization
- R06 — Specify stale-response behavior
- R07 — Handle every network outcome
- R08 — Preserve progress without preserving card fields
- R09 — Prefer semantic controls
- R10 — Optimize the expensive path, not the fashionable API
- R11 — Treat images as network and layout work
- R12 — Test behavior at user-visible boundaries

## Execution Steps
1. Map the product → checkout → pending → confirmed/failed states and identify which values are server-owned, shared, or local.
2. Separate pure display from interaction and I/O boundaries; choose state ownership before adding hooks or Redux.
3. Implement semantic forms and accessible state feedback, then prove failure, retry, and refresh behavior.
4. Profile an actual problem before memoizing; inspect bundle/image cost and test narrow-screen rendering.
5. Run build/lint and user-visible tests available in the repository; state clearly if frontend Jest is not yet configured.

## Output Contract
Report state ownership, server-authoritative fields, interaction/error states, verification commands, performance evidence, and unresolved tradeoffs.

## References
Read the local [React field guide](references/field-guide.md) and its linked official React sources. The [shared source map](../_shared/sources.md) includes the Vercel performance reference; apply only client-SPA rules that fit this project.
