# Frontend checkout

React, TypeScript, Vite, and Redux Toolkit power the mobile-first checkout SPA. **Current scope (F1/F1L):** the Spanish (Colombia) product screen reads one seeded product and a server-priced quote, lets the buyer choose an in-stock quantity, and shows loading, error, retry, and sold-out states. The API remains authoritative for price and stock. The display name and description are localized for this one verified product ID; the frontend does not translate arbitrary API products or decide payment success.

The **Tarjeta y entrega** screen is a temporary placeholder. Card entry, tokenization, summary, payment submission, final status, and refresh recovery are not implemented in this frontend yet. There is no deployed frontend URL.

## Run locally

Vite 8 requires Node.js `^20.19.0 || >=22.12.0`. This frontend was verified with Node.js `v24.20.0` and npm `11.19.0`; the project does not declare a separate npm engine range.

1. Start the [backend](../backend/README.md#run-locally) at `http://localhost:3000`. Its local setup requires PostgreSQL, a seed, and untracked server configuration even for product reads.
2. From `frontend/`, run:

   ```bash
   npm ci
   npm run dev
   ```

3. Open the local URL printed by Vite (normally `http://localhost:5173`). The development proxy forwards product and checkout requests to `http://localhost:3000`; no API key or card data belongs in the frontend environment.

For a separate HTTPS API origin, set the **public** `VITE_API_BASE_URL` at build time (see [.env.example](.env.example)). Leave it unset for the local proxy. A separate origin also requires backend CORS and browser security-policy configuration before deployment; those are not established by this frontend setup. Do not put server secrets in `VITE_*` variables.

## Verify

Run from `frontend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:coverage
```

Observed locally on 2026-09-27: build and lint passed; Jest passed **4 suites / 16 tests**. F1/F1L coverage reported **93.29% statements, 86.04% branches, 97.61% functions, and 95.45% lines**. The Vite-only API-origin configuration is mocked in Jest and has no direct Jest coverage. These figures describe the current partial frontend, **not** the completed five-step checkout or its final coverage target. Recheck the coverage file scope when the full UI is implemented.

The localized F1 product screen was visually checked in the in-app browser at desktop width and in Brave at `375 × 667` and `320 × 568` CSS pixels. At both mobile sizes, the document had no horizontal overflow, the fixed checkout action remained reachable, quantity 1 → 2 updated the server-priced subtotal, and the temporary second step displayed Spanish copy. No relevant browser console errors were observed. These checks used a disposable local product/quote API stub, not the real backend. Both tested browsers use Chromium; this is not cross-engine or physical-device certification.
