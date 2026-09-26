# NestJS API field guide

The backend scaffold is Nest + TypeScript with Jest. This guide is a decision aid, not a claim that validation, Swagger, persistence, or payment integration is already installed. Check `backend/package.json` and installed package versions before using an API from current documentation.

## Priority map

| Priority | Concern | Failure if ignored |
| --- | --- | --- |
| Critical | Boundary validation and trusted pricing | Client controls price/stock or sends malformed data. |
| Critical | Thin controllers and use-case ownership | Business rules become tied to HTTP. |
| High | Explicit error/status contract | Ambiguous pending/failure or leaked internals. |
| High | Provider wiring and E2E proof | Unit tests pass while the app route fails. |

### R01 — Specify the HTTP contract first

For each endpoint, write method, path, request fields, response shape, success/failure statuses, authentication needs, and retry semantics. Distinguish a request accepted for processing from a final successful transaction. Avoid inventing CRUD endpoints merely because Nest can generate them.

### R02 — Validate untrusted boundaries

Validate IDs, quantity as an integer in allowed range, string lengths, expected object shape, and unknown fields. TypeScript types vanish at runtime; a DTO type alone is not validation. If using `ValidationPipe`, verify the companion packages and options (`whitelist`, `forbidNonWhitelisted`, transformation) are installed and configured deliberately. Revalidate business rules in the use case against server data.

### R03 — Keep controllers as adapters

Controllers receive transport input, call a use case, and map its result to HTTP. They should not calculate the authoritative price, decrement stock, decide delivery creation, or call a third-party SDK directly. That logic belongs behind the application/domain boundary described by the hexagonal skill.

### R04 — Bind abstractions at the composition root

Nest modules/providers wire use cases to adapters. TypeScript interfaces do not exist at runtime; use a stable injection token or another supported provider token for a port. Avoid circular module imports and framework decorators in domain entities. Document the exact binding so tests can replace the adapter.

### R05 — Map failures intentionally

Separate malformed input, missing resource, business rejection, conflict/duplicate, unknown/pending external outcome, and internal fault. Choose HTTP statuses by semantics and maintain a safe response body. Preserve diagnostic cause server-side without logging secrets or raw card data. Do not turn every expected business rejection into a 500.

### R06 — Handle request lifecycle deliberately

Pipes, guards, interceptors, and filters solve different boundary problems. Use a guard for authorization, a pipe for transformation/validation, an interceptor only for a cross-cutting concern, and a filter for translating thrown faults when needed. Do not stack abstractions before a concrete need or assume their order without checking Nest's request-lifecycle docs.

### R07 — Treat configuration as an external dependency

Load environment values through a clear configuration boundary, validate required settings on startup, and keep secrets server-side. Do not commit `.env` values or return them through an endpoint. CORS is an origin policy, not authentication. Security headers and TLS ownership belong to the actual serving layer.

### R08 — Make repeated requests safe

Payment initiation, status polling, and stock/delivery side effects have different retry semantics. Design request identity/idempotency and transaction-state transitions at the use-case boundary; a disabled frontend button is not enough. A timeout does not prove failure. Test duplicate submission and late external status.

### R09 — Test the right layer

Unit-test pure use cases with fake ports; test controllers for mapping and validation; run E2E tests through a bootstrapped Nest app to verify route/module/pipe wiring. One passing scaffold test for `GET /` is not coverage of the future checkout API. Record commands, counts, and coverage honestly.

### R10 — Check version-sensitive examples

Nest documentation may describe APIs newer than the installed framework. Compare `@nestjs/core` and related installed versions, not just the CLI version. In particular, security-header APIs must be checked before use. Prefer documented mechanisms for the installed version rather than copying current snippets blindly.

## Review checklist

- Is every request field validated at runtime and every price/stock value server-owned?
- Can the use case run without Nest or an HTTP request object?
- Are business failures distinct from internal faults and pending outcomes?
- Are port tokens and provider bindings explicit and replaceable in tests?
- Do E2E tests prove pipes/routes/status mapping, not only a service method?
- Are version-sensitive APIs verified against installed packages?

## Primary sources

- [Nest controllers](https://docs.nestjs.com/controllers)
- [Nest providers](https://docs.nestjs.com/providers)
- [Nest custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [Nest validation](https://docs.nestjs.com/techniques/validation)
- [Nest request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)
- [Nest testing](https://docs.nestjs.com/fundamentals/testing)
