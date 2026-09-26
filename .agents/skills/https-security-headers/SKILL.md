---
name: https-security-headers
description: "Trigger: HTTPS, TLS, HSTS, CSP, security headers. Configure and verify transport/browser protections at the correct serving layer."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when configuring public HTTP traffic, a reverse proxy, CDN, Nest responses, or browser security headers.
Read the [transport and headers field guide](references/field-guide.md) before choosing controls; ownership differs between static SPA, API, and TLS terminator.

## Hard Rules
- Require HTTPS for public frontend/API traffic; do not send secrets over HTTP or permit mixed-content calls.
- Identify which layer serves each response before placing headers; do not assume API headers protect CDN-served SPA assets.
- Check the installed Nest version: `app.useSecurityHeaders()` is documented for v12.1+; use the version-appropriate official mechanism.
- Apply HSTS only after HTTPS and certificate/domain coverage are verified; assess `includeSubDomains` and preload carefully.
- Test actual response headers and browser behavior; do not assert protection based on configuration text alone.
- Treat CSP, CORS, cookies, and TLS as distinct controls; test realistic frontend→API requests and error/static responses.

## Decision Gates
| Serving layer | Action |
| --- | --- |
| Nest API | Configure API response protections at Nest or proxy, version-aware. |
| Static SPA/CDN | Configure headers at static hosting/CDN. |
| Local HTTP development | Do not mistake it for production TLS proof. |
| HSTS default includes subdomains | Verify all subdomains and certificate coverage before using that default in production. |
| SPA calls an API on another origin | Configure CSP `connect-src` on the SPA-serving layer and CORS on the API deliberately. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Require public HTTPS end to end
- R02 — Treat HSTS as a deployment decision
- R03 — Choose CSP from real resource needs
- R04 — Separate CSP and CORS
- R05 — Protect content type, framing, and referrer data
- R06 — Verify the framework version
- R07 — Decide cookie controls if cookies exist
- R08 — Test actual responses and browser behavior

## Execution Steps
1. Map public origins, TLS termination, redirects, static hosting, API, and which layer owns every response.
2. Choose HSTS/CSP/frame/content-type/referrer controls after checking real assets, scripts, API origins, and subdomains.
3. Configure only the version-supported framework/proxy mechanism and verify success, error, static, and preflight responses over HTTPS.
4. Report observed headers, browser-console policy violations, TLS evidence, and infrastructure gaps.

## Output Contract
Report serving layers, exact observed headers/URLs, TLS certificate/redirect evidence, CSP/CORS behavior, and unresolved gaps.

## References
Read the local [transport and headers field guide](references/field-guide.md) and its Nest/OWASP/MDN sources; see the [shared source map](../_shared/sources.md).
