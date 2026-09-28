# Frontend checkout

React, TypeScript, Vite, and Redux Toolkit power the mobile-first checkout SPA. **Current local scope (catalog through payment status):** the Spanish (Colombia) ShopiFast catalog reads the product list from `GET /products`, offers a breadcrumb back from a selected product, and lets the buyer choose one in-stock quantity for a server-priced quote. Loading, empty, error, retry, and sold-out states are shown. A background catalog refresh keeps the previously loaded cards visible and warns when those details may be stale after a failed refresh; selecting a product always fetches its current detail by ID. The API remains authoritative for product names, descriptions, prices, stock, quotes, and final payment/fulfillment state.

The catalog presents ten seeded demo products in a responsive grid, but checkout still handles **one selected product at a time**; it has no cart or multi-item payment. Selection resets the previous product, quantity, quote, and pending request identities before fetching the chosen product by ID. Product photos and the store mark are local, optimized assets under `public/`. Images are not stored in PostgreSQL or served by the product API; an unknown catalog product shows a neutral image-unavailable state rather than the wrong product photo. Each seeded product has two local WebP views in a product-ID manifest; the detail gallery supports arrows, thumbnails, and a full-viewport modal with keyboard navigation, Escape, and focus restoration. In the catalog, the first two visible-list images load eagerly (the first with high fetch priority) and later images are lazy-loaded with reserved intrinsic dimensions. On the selected product, both images load eagerly through the thumbnails so the full view uses the same URLs. This optimizes likely first paint and image reuse but is not a production latency measurement. The ShopiFast wordmark uses a self-hosted Grand Hotel font from `@fontsource/grand-hotel` (OFL-1.1), scoped to the brand text; no font CDN is needed.

The product action opens an accessible **Tarjeta y entrega** modal. It validates Visa/Mastercard card details, contact and delivery fields, presents two current consent documents from `GET /checkout/consents` as separate unchecked choices, and tokenizes the card in the browser only after an explicit valid submission. The animated card preview shows at most the first eight digits and a masked security code. The browser encrypts card data locally and sends only a compact JWE to same-origin `POST /checkout/card-tokens`; the API relays it to a fixed sandbox destination and returns only an opaque token. Raw card fields never enter the API. The summary re-requests the server quote and displays product, mandatory base and delivery fees, total, delivery, and masked card details. Its payment action opens a native confirmation dialog with the final amount; only its explicit confirmation handler calls `POST /checkouts` with `expectedTotalCents` and the original UUIDv4 `Idempotency-Key`. The backend rejects a changed total before payment. The status screen reads local payment and fulfillment state, offers bounded automatic checks and manual rechecks, and returns to a freshly fetched product after a safe resolved outcome. Local sandbox terminal approval and fulfillment have been observed after operator reconciliation; a deployed frontend and public callback remain unverified.

Before payment, versioned product ID and quantity plus an allowlisted contact/delivery draft are saved in this tab's `sessionStorage`. The draft contains only email, recipient, address, and city; it is cleared when checkout is completed or abandoned. It is not durable across tabs or browser sessions. Refresh re-fetches the product and quote, and card details and both consents must be supplied again. Immediately before POST, a separate versioned allowlist saves product ID, quantity, and the original random idempotency key. Refresh or a lost POST response recovers with read-only `GET /checkouts/status` by that key; it does not create a new payment. An existing unreadable recovery record blocks new submission rather than risking a second charge. A rejected POST remains associated with its key until a status GET confirms no local transaction. Raw card number, cardholder name, expiration, security code, token, and consent tokens are not stored in Redux or browser storage. They remain transient in the current App instance and are discarded after initiation or navigation. `APPROVED` with `STOCK_UNAVAILABLE` is not a delivery: the screen retains tracking/recheck and does not offer repurchase.

## Run locally

Vite 8 requires Node.js `^20.19.0 || >=22.12.0`. This frontend was verified with Node.js `v24.20.0` and npm `11.19.0`; the project does not declare a separate npm engine range.

1. Start the [backend](../backend/README.md#run-locally) at `http://localhost:3000`. Its local setup requires PostgreSQL, a seed, and untracked server configuration even for product reads.
2. From `frontend/`, run:

   ```bash
   npm ci
   npm run dev
   ```

3. Open the local URL printed by Vite (normally `http://localhost:5173`). The development proxy forwards product and checkout requests to `http://localhost:3000`. The development proxy also forwards the same-origin tokenization bridge. Configure the sandbox host and matching public key on the backend only; no provider URL or key is required in Vite. The browser does not call the sandbox directly, because the observed UAT key GET lacks the browser CORS response header. Live browser JWE tokenization remains unverified.

For production, route `/checkout/*` and `/checkouts/*` from the SPA origin to the Nest API with HTTPS and caching disabled; keep the current same-origin tokenization calls. Product reads may use the public `VITE_API_BASE_URL` as before. A separate API origin still requires deliberate CORS and browser security-policy configuration. Do not put server secrets in Vite. A `503` from `/checkout/consents` prevents continuation and exposes a retry action; configure the backend rather than bypassing the consents. The current tokenization guard is process-local; public multi-replica deployment needs edge/distributed abuse controls and verified proxy identity. Do not put server secrets in `VITE_*` variables.

## Verify

Run from `frontend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:coverage
```

Observed locally on 2026-09-27 for the Hito 3 checkout frontend: build and lint passed; Jest passed **15 suites / 112 tests**. Coverage was **92.92% statements, 90.13% branches, 95.53% functions, and 94.85% lines** across the configured `src/` scope. `frontend/jest.config.cjs` enforces strictly greater than 80% on all four metrics. Tests cover visible confirmation/status behavior, safe recovery and no duplicate POST after refresh, changed quote handling, consent gating, error/retry, and one real JOSE compact-JWE encrypt/decrypt contract using a disposable in-memory RSA key and mocked same-origin network. The latter is cryptographic local evidence, **not** live browser/provider interoperability. The Vite-only API-origin configuration is mocked in Jest and has no direct Jest coverage. These figures do not establish a deployed callback or public deployment; separately observed local sandbox approval required operator reconciliation.

The earlier single-product screen was visually checked in the in-app browser at desktop width and in Brave at `375 × 667` and `320 × 568` CSS pixels. Those checks used a disposable local API stub, not the real backend. Confirmation/status browser QA at 320, 375, 542, and 1280 CSS pixels with a mocked API covered keyboard focus and refresh recovery; native zoom, a physical phone, and a second engine remain unverified. Separately, local sandbox transactions reached terminal approval through operator reconciliation, including a buyer-browser journey. This does not verify public event delivery or automatic recovery in AWS.
