# Railway-oriented use-case field guide

Railway Oriented Programming (ROP) is a way to make expected failure paths explicit and composable. It does not remove the need for transactions, idempotency, or infrastructure error handling. The original material is in F#; adapt the reasoning to readable TypeScript, not the syntax wholesale.

## Outcome taxonomy

| Outcome | Example | Recommended treatment |
| --- | --- | --- |
| Business rejection | Invalid quantity, unavailable stock | Typed expected failure. |
| External final rejection | Payment declined | Typed outcome; no success-only effects. |
| Pending/unknown | Accepted but not final, timeout | Preserve reference and reconcile; not success or final failure. |
| Infrastructure fault | Database unavailable, malformed remote response | Preserve cause internally, expose safe boundary error. |
| Partial completion | Payment confirmed, stock write failed | Explicit recovery/reconciliation state; no silent success. |

### R01 — Define a narrow Result contract

Use a discriminated union or small helper that makes success and expected failure impossible to confuse. Do not wrap every pure function in Result when it cannot fail meaningfully.

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

The type is illustrative, not an instruction to create a global utility now. Error variants should carry stable machine meaning, not raw SDK exceptions or HTTP status codes.

### R02 — Validate before effects

Check quantity, product availability, trusted price, shipping data, and existing transaction state before initiating an external operation. Keep deterministic validation pure when practical. Test that a validation failure does not call payment, stock, or delivery ports.

### R03 — Compose success-only steps

Each step receives a successful value or returns a failure. A failure exits the success path. Avoid a `try/catch` around the whole flow that accidentally continues after logging. State the sequence and its side effects in the use-case contract so tests can prove where it stops.

### R04 — Treat pending as a first-class outcome

An accepted request or HTTP 2xx from a remote service may still represent a pending transaction. A timeout may mean the request executed but the response was lost. Neither case permits stock decrement or delivery creation. Retain a safe reference and reconcile against authoritative status.

### R05 — Separate expected errors from unexpected faults

Domain failures (unavailable stock, validation) are normal alternatives. Transport failures, parsing faults, or unavailable storage are operational faults. Translate them at adapters into application-safe variants while preserving non-sensitive diagnostics. Do not leak raw remote error bodies through `Result.error` into public responses.

### R06 — Design retries and idempotency

An effectful step can be retried only with a defined identity and deduplication rule. A double click or network retry must not create two independent successful purchases. A Result pipeline by itself does not make retries safe; record which port enforces the identity and how duplicate responses are handled.

### R07 — Admit partial failure

If an external payment is confirmed and a local stock update fails, returning a generic failure does not reverse the payment. Record a recoverable state and specify reconciliation or compensation before claiming the workflow is complete. Do not hide this concern behind a single `bind` chain or pretend a database transaction spans a remote provider.

### R08 — Keep boundary mappings outside the core

The use case returns domain/application outcomes. The Nest adapter maps them to HTTP statuses and safe response shapes. The frontend maps those statuses to accessible UI states. Do not embed HTTP exceptions or UI messages in core Result variants.

### R09 — Keep the code readable

Prefer an explicit sequence of a few named operations over dense functional combinators that obscure which side effect happens when. Use `map` for pure success transformation and `bind/flatMap` for steps that may fail when helpers genuinely improve clarity. Do not introduce a dependency only for nomenclature.

### R10 — Test the negative paths as invariants

For every expected failure, assert both the returned variant and forbidden calls: payment not initiated after validation failure, stock unchanged after decline/pending, delivery absent after failure, duplicate requests deduplicated, and unknown status recoverable. Include adapter faults and partial-completion scenarios.

## Review checklist

- Does the Result type distinguish rejection, unknown/pending, and operational fault?
- Are irreversible effects guarded by confirmed authoritative state?
- Can a retry or duplicate request create the same side effect twice?
- Is a partial completion represented honestly with a recovery path?
- Do tests assert absence of forbidden stock/delivery calls?
- Is the TypeScript flow easier to read than a straightforward imperative alternative?

## Primary sources

- [Scott Wlaschin: Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [Alistair Cockburn: Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
