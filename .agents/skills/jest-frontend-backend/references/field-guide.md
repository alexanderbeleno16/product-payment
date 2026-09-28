# Jest testing field guide

The brief requires Jest unit tests in both frontend and backend and more than 80% coverage. Both applications now have Jest scripts. The Vite frontend uses `frontend/jest.config.cjs` with SWC, jsdom, and Testing Library; a dedicated Node-environment test exercises real JOSE encryption with a disposable in-memory key. Test presence is not a coverage measurement: run each application's coverage command and report the observed result.

## Evidence layers

| Layer | Best question | Typical tools |
| --- | --- | --- |
| Pure unit | Does a domain rule produce the right result and prevent forbidden effects? | Jest, fake ports. |
| React component | Can a user perceive and perform the interaction? | Jest DOM environment, Testing Library. |
| Adapter contract | Does serialization or external protocol mapping work? | Jest, controlled boundary/fixture. |
| Nest E2E | Do route, providers, pipes, and response mapping work together? | Nest testing module, Supertest. |

### R01 — Derive tests from acceptance behavior

For each checkout step, list success, invalid input, boundary, duplicate, pending, failure, and retry cases. A high coverage percentage with no failed-payment or stock-invariant test is weak evidence. Name tests by behavior rather than private method names.

### R02 — Keep domain tests independent

Instantiate a use case with small fake ports. Assert both the returned result and which ports were or were not called. On a declined or pending payment, verify stock and delivery ports were not invoked. Do not mock the use-case method itself when testing its business behavior.

### R03 — Test React through the DOM

Prefer queries by role, label, and visible text. Trigger interactions as a user would and await async UI updates. Avoid asserting component internals or snapshotting entire checkout pages as the primary proof. Test focus, error associations, pending announcements, and refresh behavior where relevant.

### R04 — Verify frontend Jest configuration

Vite compilation does not configure Jest. The current runner is separate: SWC transforms TypeScript/JSX, jsdom supports DOM tests, style/assets have a mapper, and Testing Library setup is explicit. `jose` is transformed for the Node-environment cryptographic contract test. Verify the config with a focused suite and the full run; do not infer browser behavior from a Node crypto test or crypto correctness from a mocked DOM test.

### R05 — Use Nest E2E for wiring

Boot a Nest test application with the same relevant module/pipe configuration as production. Issue HTTP requests and assert status, response shape, validation rejection, provider wiring, and safe errors. The generated scaffold `GET /` test proves only that scaffold route, not the future checkout API.

### R06 — Mock at true boundaries

Mock the external service, clock, or persistence port when isolating core logic. Prefer in-memory fakes with explicit state for important behavior. Reset mocks between tests. Do not mock so many internal helpers that a test merely rehearses implementation steps.

### R07 — Make time and network deterministic

Use controlled promises, fake clocks, or injected time when behavior depends on polling, expiry, or timeout. Distinguish an actual final rejection from an unknown status caused by a timeout. Test stale responses and duplicate retries without sleeping for real time.

### R08 — Treat coverage as scoped evidence

Run coverage independently in `frontend/` and `backend/`. Report statements, branches, functions, and lines, plus included files and justified exclusions. The brief says **more than 80%**, so exactly 80 is insufficient. Aim beyond the threshold in critical logic; do not hide uncovered code through broad `collectCoverageFrom` exclusions. A passing test count is not a coverage measurement.

### R09 — Prove negative invariants

Include assertions for `not.toHaveBeenCalled()` or equivalent state evidence when an operation must not occur: no stock decrement, no delivery creation, no second submission, no secret persistence, no UI-confirmed success while status is pending. These negative assertions are central to checkout correctness.

### R10 — Keep test data safe and meaningful

Use fictitious non-sensitive values and authorized sandbox fixtures only. Never commit actual card details or credentials. Keep fixtures small and valid by default; override only the field under test so failures identify a real contract violation.

### R11 — Report exact execution

For each test run, record command, passing/failing suite count, test count, and environment. If a runner is unavailable on another clone, say so rather than implying the backend result covers both applications. If tests fail, report the failure rather than reducing coverage scope to make the run green.

## Review checklist

- Does every critical business failure have a test for prevented effects?
- Are React tests user-visible and Nest tests proving actual wiring?
- Are network, time, and persistence deterministic at test boundaries?
- Are coverage metrics measured separately and above the required threshold?
- Are exclusions justified and does branch coverage expose missing paths?
- Is the frontend runner actually installed/configured before tests are claimed?

## Primary sources

- [Jest configuration and coverage thresholds](https://jestjs.io/docs/configuration)
- [Jest mock functions](https://jestjs.io/docs/mock-functions)
- [Nest testing](https://docs.nestjs.com/fundamentals/testing)
- [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/)
