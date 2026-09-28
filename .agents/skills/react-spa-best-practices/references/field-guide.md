# React SPA field guide

This is operational guidance for the React + TypeScript Vite SPA. Redux Toolkit, Jest, and API clients are now installed; that fact alone does not prove correct behavior. Each rule is a review question and should be applied only when the change touches that concern.

## Priority map

| Priority | Area | Why it matters for this checkout |
| --- | --- | --- |
| Critical | State ownership and payment authority | Prevent impossible UI states and false success. |
| High | Effects and asynchronous requests | Prevent stale responses and duplicate operations. |
| High | Form semantics and sensitive input | Keep checkout usable without storing card details. |
| Medium | Component boundaries and rendering | Make screens testable and changes localized. |
| Measured | Bundle and image performance | Optimize actual bottlenecks, not guesses. |

## State and component rules

### R01 — Model states rather than a collection of booleans

For a mutually exclusive flow, prefer a discriminated state such as `editing | submitting | pending | confirmed | failed`. Separate recoverable UI state from the authoritative transaction result. Review whether any two flags can claim contradictory outcomes.

```ts
type CheckoutView =
  | { status: 'editing' }
  | { status: 'submitting' }
  | { status: 'pending'; reference: string }
  | { status: 'confirmed'; reference: string }
  | { status: 'failed'; message: string };
```

This is a conceptual UI contract, not a backend transaction schema. A `confirmed` view must come from a verified API outcome, never from a timer or successful click alone.

### R02 — Derive instead of synchronizing

If a value can be computed from current props/state, compute it during render or in a selector. Do not maintain `quantity`, `price`, and a separately mutable `total` that can disagree. A client total is display-only; the server must recalculate charges from trusted product data.

### R03 — Place state at the narrowest useful owner

Keep an open tooltip or focused field local. Lift state only when siblings truly coordinate. Use Redux for cross-screen non-sensitive checkout progress, not every keystroke. Do not copy server data into local and global state without a reconciliation rule.

### R04 — Define component contracts around responsibility

Keep display components concerned with props and semantic markup. Let a page/container coordinate data retrieval and transitions. Extract a component when it has independent behavior or reuse, not merely because a file is long. Avoid defining component types inside render functions when identity must remain stable.

## Effects and asynchronous work

### R05 — Put user actions in handlers; reserve Effects for synchronization

Submitting a form belongs to an explicit event handler or state-management effect boundary. An Effect should synchronize with an external system and have cleanup when needed. Do not use an Effect just to calculate a value from state. Under development Strict Mode, Effects may run more than once; a payment initiation must not rely on an Effect that can accidentally duplicate a write.

### R06 — Specify stale-response behavior

When product or transaction status is fetched, define what happens if inputs change or the component unmounts. Use a cancellation signal or ignore stale responses. A late response for an old product must not overwrite the current selection. Disable repeated submission in the UI, but enforce duplicate protection on the server too.

### R07 — Handle every network outcome

For each request, identify loading, success, empty, validation failure, transient failure, and unknown/pending outcomes. A transport timeout does not prove a payment failed; show a recoverable state and re-query the authoritative status. Keep safe, human-readable errors separate from raw server diagnostics.

## Forms and sensitive data

### R08 — Preserve progress without preserving card fields

It is valid to retain product, quantity, shipping/contact data when necessary and safe. Keep card number, expiry, security code, and cardholder fields out of Redux persistence, localStorage, sessionStorage, URLs, analytics, and logs. Clear sensitive fields on refresh as agreed for this project. Do not assume browser autofill is application persistence.

### R09 — Prefer semantic controls

Use native labels, inputs, buttons, fieldsets, and error associations. Make status transitions readable to assistive technology. Keep focus behavior coherent after validation errors and screen changes. Consult the accessibility skill for dialog and announcement rules.

## Performance and verification

### R10 — Optimize the expensive path, not the fashionable API

Profile a slow render before adding `memo`, `useMemo`, or `useCallback`; these add complexity and may not help. Prefer removing redundant state, reducing subscriptions, and narrowing component boundaries. Lazy-load optional heavy UI only after observing a meaningful bundle cost.

### R11 — Treat images as network and layout work

Serve appropriately sized/compressed product media, include intrinsic dimensions or aspect ratio to avoid layout shifts, and check actual transfer size. Verify that long titles, image placeholders, and failures remain within narrow-screen bounds.

### R12 — Test behavior at user-visible boundaries

Test quantity changes, validation, submit-disabled state, stale response, pending status, failed status, refresh recovery, and no sensitive persistence. Prefer DOM assertions over internal hook implementation. Build and lint remain useful but do not prove checkout behavior or accessibility.

## Review checklist

- Is each value classified as local, shared, persisted, or server-authoritative?
- Can any state combination be contradictory, or can an old response overwrite a newer view?
- Can a re-render, refresh, or Effect replay initiate a second payment?
- Are failures and pending states distinguishable and recoverable?
- Are sensitive fields absent from persistence, logs, URLs, and action payloads?
- Were images, mobile bounds, keyboard behavior, and actual bundle/render cost checked?

## Primary sources

- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- [Vercel React best-practices skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) — inspiration for indexed rules, not a Next.js dependency.
