# Redux Toolkit and Flux field guide

The brief requires Redux-style one-way flow in the React SPA. This guide does not install Redux Toolkit or define the final transaction API. Use it to make state ownership and security explicit before implementation.

## Priority map

| Priority | Decision | Failure if ignored |
| --- | --- | --- |
| Critical | Separate server authority and secret inputs from UI state | False success or sensitive-data exposure. |
| High | Define checkout transitions and async ownership | Races, duplicate writes, impossible states. |
| High | Allowlist persisted fields with migration | Stale or leaked data after refresh. |
| Medium | Typed selectors and feature slices | Scattered coupling and unnecessary renders. |

## The one-way flow

The intended path is **UI event → action → reducer or async boundary → new state → selector → render**. Reducers calculate state from an action; they do not fetch, log, navigate, mutate external objects, or trigger payment operations. A network response enters as another action after the boundary validates and classifies it.

### R01 — Classify each field before storing it

| Field | Owner | Store decision |
| --- | --- | --- |
| Quantity and selected product ID | User choice | Shared state if multiple screens need it; validate again at API. |
| Product price and stock | Server | Cache with freshness/reconciliation; never treat as authority. |
| Transaction reference and status | Server | Store safe reference/status for display and polling; confirm with API. |
| Card number, expiry, security code, cardholder entry | Sensitive form input | Ephemeral local form state only; never Redux action or persistence. |
| Modal open/focus state | View | Local component state unless multiple screens truly coordinate. |

The distinction is conceptual: a value being in Redux does not make it trusted. A reducer cannot certify a charge or stock mutation.

### R02 — Make transitions explicit

Define allowed transitions before implementing actions. For example, `editing → submitting → pending → confirmed | failed`; a rejected validation returns to `editing` with field errors. A timeout may leave `pending/unknown`, not automatically `failed`. Reject stale or out-of-order responses by checking request/transaction identity. State should represent one status, not independent `isLoading`, `isPaid`, and `hasFailed` booleans.

### R03 — Keep slices feature-focused

Use `configureStore`, `createSlice`, and selectors. Name actions as observable events (`quantityChanged`, `submissionStarted`, `statusReceived`) rather than generic setters when this clarifies the domain. Do not create one global slice for every screen or one slice per visual component. Keep normalized server collections only when needed; do not normalize a single product ceremonially.

### R04 — Keep reducers pure even with Immer

Redux Toolkit permits draft-like syntax inside `createSlice`, but the resulting reducer must remain deterministic and side-effect-free. Do not mutate objects outside the draft, read the current time, generate random IDs, call storage, or invoke the API from reducers. Ensure action payloads are serializable and safe to inspect in development tools.

### R05 — Type boundaries from the store

Infer `RootState` from `store.getState` and `AppDispatch` from `store.dispatch`; expose typed hooks/selectors. Avoid duplicating hand-maintained state interfaces that drift from the configured store. Select the smallest needed value, and derive display totals rather than persisting redundant totals.

### R06 — Choose one async strategy deliberately

Use a small thunk for an isolated workflow when direct control and few endpoints suffice. Consider RTK Query when request caching, deduplication, invalidation, and polling are central. Either choice must handle aborts, stale responses, retries, and safe error mapping. Do not dispatch a success action merely because the HTTP request was accepted; inspect the API's actual transaction status.

### R07 — Persist only an allowlist

If refresh recovery is required, serialize an explicit safe subset such as selected product ID, quantity, step, and safe transaction reference. Version the shape, validate on read, and discard unknown/expired data. Never persist a whole slice by convenience. Test that card fields and raw provider/API responses are absent from localStorage, sessionStorage, Redux DevTools action payloads, and logs.

### R08 — Reconcile after refresh or retry

On reload, use a safe reference to ask the backend for authoritative status. Do not resurrect a `confirmed` state purely from localStorage. Clear/replace stale product data when the backend reports changed price or unavailable quantity. Define whether the UI can retry a failed attempt or must start a new one.

### R09 — Test transitions and failures

Test reducers as pure state transitions; test selectors for derived values; test async boundaries with controlled responses. Include double submit, old response after new request, timeout/unknown status, refresh migration, malformed storage, and secret-redaction cases. A green reducer test does not verify the network integration or browser persistence path.

## Review checklist

- Is every state field classified as local, shared, server-owned, or sensitive?
- Are actions serializable and safe for developer tooling?
- Can two flags conflict or a stale response move a new transaction backward?
- Is the persisted payload allowlisted, versioned, validated, and tested?
- Does the UI re-query payment status rather than trusting cached success?
- Are async strategy and cache invalidation justified by actual needs?

## Primary sources

- [Redux Toolkit quick start](https://redux-toolkit.js.org/tutorials/quick-start)
- [Redux fundamentals: concepts and data flow](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow)
- [Redux style guide](https://redux.js.org/style-guide/)
- [Redux Toolkit TypeScript usage](https://redux-toolkit.js.org/usage/usage-with-typescript)
- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
