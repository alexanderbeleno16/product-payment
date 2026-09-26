---
name: owasp-web-api
description: "Trigger: OWASP, API security, input validation, sensitive data, CORS. Check web/API threats using primary OWASP guidance."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when implementing or reviewing requests, responses, storage, logging, browser flows, or external integrations.
Read the threat-specific section of the [OWASP field guide](references/field-guide.md) before declaring a security control complete.

## Hard Rules
- Treat every client value as untrusted; validate type, range, format, length, and allowed fields at the API boundary.
- Keep credentials and raw card data out of URLs, logs, errors, analytics, commits, and persisted browser state.
- Use least privilege and narrow CORS origins; do not expose secrets to the SPA.
- Return safe failure messages while preserving diagnosable server-side causes without sensitive payloads.
- Distinguish controls actually implemented from recommendations; do not claim OWASP compliance from a checklist alone.
- Enforce object-level authorization and server-owned values wherever a client can name a product, transaction, or delivery.
- Make duplicate requests, out-of-order status changes, and unknown external outcomes explicit abuse/correctness cases.

## Decision Gates
| Risk | Check |
| --- | --- |
| New input field | Validation and rejection tests. |
| New external call | Secret handling, timeout, safe error mapping. |
| New persisted value | Sensitivity and retention review. |
| Client supplies amount or status | Ignore as authority; derive/verify on the server. |
| Repeated state-changing request | Define idempotency and abuse controls, not only a disabled UI button. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Map trust boundaries before controls
- R02 — Validate syntax and business meaning separately
- R03 — Authorize each object access
- R04 — Minimize sensitive data everywhere
- R05 — Separate secret handling by tier
- R06 — Treat CORS as an origin policy, not authentication
- R07 — Resist replay and order abuse
- R08 — Return safe errors and log useful context
- R09 — Harden external calls
- R10 — Verify controls negatively

## Execution Steps
1. Map data flows, assets, trust boundaries, actors, and misuse cases for the changed endpoint or screen.
2. Choose concrete controls for validation, authorization, sensitive data, retries, and abuse; identify their owning layer.
3. Add negative tests and inspect real requests, responses, storage, and redacted logs.
4. Record residual risk, infrastructure dependencies, and what was not tested; avoid blanket compliance claims.

## Output Contract
Report each threat, affected boundary, implemented control, negative-test evidence, residual risk, and deferred owner.

## References
Read the local [OWASP field guide](references/field-guide.md) and its primary cheat sheets; see the [shared source map](../_shared/sources.md).
