# OWASP-aligned web and API field guide

Use OWASP cheat sheets as risk/control references, not as a badge of compliance. The review unit is a concrete data flow or endpoint. Payment, stock, contact/shipping data, secrets, and transaction status have different owners and exposure risks.

## Threat-to-control matrix

| Threat | Boundary | Control to verify |
| --- | --- | --- |
| Tampered amount/quantity/status | Browser → API | Runtime validation and server-authoritative calculation/state. |
| Unauthorized transaction lookup | API → storage | Object-level authorization or unguessable/limited access policy. |
| Duplicate or reordered request | API/use case | Idempotency, state-transition checks, replay tests. |
| Sensitive-data leak | Form/log/storage/network | Data minimization, redaction, HTTPS, persistence tests. |
| External-service failure | API → remote | Timeout, safe error translation, recovery/reconciliation. |

### R01 — Map trust boundaries before controls

List actors, browser, API, database, external service, logs, and any hosting proxy. Identify where data becomes trusted and where it leaves the system. A TypeScript type on the server does not make client JSON trusted; a secret present only in a server environment can still leak through logs or errors.

### R02 — Validate syntax and business meaning separately

Reject malformed types, length/range violations, unexpected fields, and unsupported content types at the transport boundary. Then verify business conditions using server data: current product price, allowed quantity, available stock, and transaction state. Do not allow a client-supplied total to override server pricing.

### R03 — Authorize each object access

If an endpoint accepts a product, transaction, or delivery identifier, decide who may read or mutate that object. An authenticated request is not automatically authorized for every ID. If the test app has no accounts, document the chosen access model and avoid exposing sensitive records through guessable references.

### R04 — Minimize sensitive data everywhere

Keep card fields out of URLs, query strings, localStorage, Redux persistence/actions, analytics, logs, exception messages, screenshots, and repository fixtures. Store only what the use case requires and define retention. A masked UI does not mean the raw value is absent from browser storage or network logs.

### R05 — Separate secret handling by tier

Public browser variables and bundled assets are not secret storage. Use server-side environment/secret mechanisms for private keys and validate configuration at startup. Never commit real credentials, print them during debugging, or return them in errors. Audit build output if a variable could be bundled into the SPA.

### R06 — Treat CORS as an origin policy, not authentication

Allow known frontend origins and required methods/headers; do not use wildcard origins with credentials. CORS does not stop non-browser clients, so endpoints still need validation, authorization, and abuse controls.

### R07 — Resist replay and order abuse

Model allowed transaction state transitions. A repeated payment request should not create duplicate effects; a late failed status should not overwrite a confirmed state without an explicit reconciliation rule. Test duplicated and out-of-order messages, timeout ambiguity, and retry after connection loss.

### R08 — Return safe errors and log useful context

Map expected failures to stable public responses without raw SDK payloads, stack traces, secrets, or card data. Log non-sensitive correlation/reference identifiers and causes at the server boundary. Avoid logging the full request body or response from a payment API.

### R09 — Harden external calls

Use fixed/allowlisted destinations rather than user-supplied URLs, bounded timeouts, controlled redirects where applicable, and safe parsing of remote responses. Treat remote status as untrusted until validated against the expected transaction. Do not assume a successful transport status means final payment success.

### R10 — Verify controls negatively

Send malformed values, unknown fields, other-object IDs, duplicate requests, out-of-order statuses, and unexpected remote responses. Inspect actual error bodies/logs and storage for sensitive values. A checklist item without an observed control/test should be marked planned, not implemented.

## Review checklist

- Which fields/IDs cross a trust boundary, and who owns their truth?
- Can a client change price, payment status, stock, or delivery state directly?
- Are object-level reads/writes authorized under the chosen access model?
- Can duplicate/out-of-order requests create extra side effects?
- Are secrets and card fields absent from browser bundles, storage, logs, and errors?
- Is every claimed OWASP alignment tied to a concrete test or configuration check?

## Primary sources

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
