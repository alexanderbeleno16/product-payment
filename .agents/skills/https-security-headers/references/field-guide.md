# HTTPS and security-headers field guide

Security headers protect the response on which they are sent. A Nest API header does not automatically protect a Vite SPA served by a different CDN or static host. TLS may terminate at a load balancer, proxy, CDN, or app; map that topology before configuring or claiming protection.

## Ownership map

| Surface | Typical owner | Verification |
| --- | --- | --- |
| SPA HTML/assets | Static host/CDN | `curl -I` and browser load on public origin. |
| API responses | Nest or upstream proxy | Success, error, 404, and preflight responses. |
| TLS/certificates/redirect | Edge/proxy/platform | Public HTTPS handshake and HTTP→HTTPS behavior. |
| CSP for SPA | SPA-serving layer | Browser console and allowed script/connect/image sources. |

### R01 — Require public HTTPS end to end

Use HTTPS for browser→frontend and browser→API traffic. If TLS terminates upstream, understand the proxy→app hop and platform trust boundary. Do not place secrets in URLs or claim production HTTPS because localhost works over HTTP. Verify actual public URLs and certificates before documentation claims.

### R02 — Treat HSTS as a deployment decision

HSTS tells a browser to use HTTPS on future connections. Send it only from a valid HTTPS response once the host is stable. `includeSubDomains` affects every subdomain; `preload` is harder to reverse and has eligibility requirements. Nest v12.1's default security-header configuration includes a long HSTS policy with subdomains, so review it instead of enabling blindly. Local HTTP does not prove HSTS behavior.

### R03 — Choose CSP from real resource needs

Inventory scripts, styles, images, fonts, API/WebSocket endpoints, and frames. Start from restrictive sources and add only required hosts or nonces/hashes. A SPA calling a separate API needs `connect-src` to allow that origin. Avoid broad `*`, `unsafe-inline`, or disabling CSP simply to silence console errors. Verify production build behavior, not only the Vite dev server.

### R04 — Separate CSP and CORS

CSP governs what the browser page may load; CORS governs which browser origins may read an API response. Neither authenticates callers. Test a real browser call, preflight when relevant, and the configured allowlist. An API `Access-Control-Allow-Origin` header does not replace SPA `connect-src`.

### R05 — Protect content type, framing, and referrer data

Use appropriate `X-Content-Type-Options`, `Referrer-Policy`, and `frame-ancestors`/frame controls for the actual application. Do not assume a CSP on JSON alone protects HTML. Check static HTML/assets and error pages as well as successful API JSON.

### R06 — Verify the framework version

Nest documents `app.useSecurityHeaders()` starting in v12.1, with framework-level defaults similar to Helmet 8. Check installed `@nestjs/core`, not just the CLI version. Call it at the documented bootstrap point if chosen. Earlier versions may require a different supported middleware; do not paste a newer API into an older app.

### R07 — Decide cookie controls if cookies exist

If authentication/session cookies are later introduced, specify `Secure`, `HttpOnly`, `SameSite`, path/domain scope, and CSRF model. Do not add cookie-policy claims when the app does not use cookies. Security headers cannot compensate for a leaked token in browser storage or logs.

### R08 — Test actual responses and browser behavior

Inspect public HTTPS redirects, certificate validity, HSTS on HTTPS, CSP on SPA HTML, API success/error/404 headers, and cross-origin requests. Watch CSP violations in the browser and confirm that valid images/scripts/API calls still work. A config file alone is not proof; report the exact URL, command/browser, and observed value.

## Review checklist

- Who terminates TLS and who serves SPA HTML versus API JSON?
- Is HSTS safe for every affected subdomain and certificate?
- Does SPA CSP allow only required scripts/images/API endpoints?
- Are CORS and CSP tested separately with actual browser traffic?
- Do success, error, 404, and static responses carry intended headers?
- Is the Nest API supported by the installed framework version?

## Primary sources

- [Nest security headers](https://docs.nestjs.com/techniques/security)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [MDN Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
