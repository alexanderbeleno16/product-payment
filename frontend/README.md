# Frontend checkout

React, TypeScript, Vite, and Redux Toolkit power the mobile-first checkout SPA. **Current scope (catalog through non-paying summary):** the Spanish (Colombia) ShopiFast catalog reads the product list from `GET /products`, offers a breadcrumb back from a selected product, and lets the buyer choose one in-stock quantity for a server-priced quote. Loading, empty, error, retry, and sold-out states are shown. A background catalog refresh keeps the previously loaded cards visible and warns when those details may be stale after a failed refresh; selecting a product always fetches its current detail by ID. The API remains authoritative for product names, descriptions, prices, stock, and quotes; the frontend does not decide payment success.

The catalog presents ten seeded demo products in a responsive grid, but checkout still handles **one selected product at a time**; it has no cart or multi-item payment. Selection resets the previous product, quantity, quote, and pending request identities before fetching the chosen product by ID. Product photos and the store mark are local, optimized assets under `public/`. Images are not stored in PostgreSQL or served by the product API; an unknown catalog product shows a neutral image-unavailable state rather than the wrong product photo. Each seeded product has two local WebP views in a product-ID manifest; the detail gallery supports arrows, thumbnails, and a full-viewport modal with keyboard navigation, Escape, and focus restoration. In the catalog, the first two visible-list images load eagerly (the first with high fetch priority) and later images are lazy-loaded with reserved intrinsic dimensions. On the selected product, both images load eagerly through the thumbnails so the full view uses the same URLs. This optimizes likely first paint and image reuse but is not a production latency measurement. The ShopiFast wordmark uses a self-hosted Grand Hotel font from `@fontsource/grand-hotel` (OFL-1.1), scoped to the brand text; no font CDN is needed.

The product action opens an accessible **Tarjeta y entrega** modal. It validates Visa/Mastercard card details, contact and delivery fields, presents two current consent documents from `GET /checkout/consents` as separate unchecked choices, and tokenizes the card in the browser only after an explicit valid submission. The animated card preview shows at most the first eight digits and a masked security code. Only encrypted card data is sent to the configured payment origin; the application receives an opaque token. The resulting summary re-requests the server quote and displays product, fees, delivery, and masked card details. Its mobile bottom action previews the total but **the payment button is intentionally disabled:** `POST /checkouts`, payment status, and final stock refresh remain frontend work for the next milestones. There is no deployed frontend URL and no verified live browser tokenization result yet.

Only a versioned, validated product ID and quantity are saved in `sessionStorage`. Refresh returns to the product, re-fetches its current detail and quote, and requires card entry and both consents again. Raw card number, cardholder name, expiration, security code, and the token are not stored in Redux or browser storage. The token and consent evidence remain transient in the current App instance; returning to product/catalog discards them.

## Run locally

Vite 8 requires Node.js `^20.19.0 || >=22.12.0`. This frontend was verified with Node.js `v24.20.0` and npm `11.19.0`; the project does not declare a separate npm engine range.

1. Start the [backend](../backend/README.md#run-locally) at `http://localhost:3000`. Its local setup requires PostgreSQL, a seed, and untracked server configuration even for product reads.
2. From `frontend/`, run:

   ```bash
   npm ci
   npm run dev
   ```

3. Open the local URL printed by Vite (normally `http://localhost:5173`). The development proxy forwards product and checkout requests to `http://localhost:3000`. To exercise browser tokenization, configure the **public HTTPS** `VITE_PAYMENT_API_BASE_URL` and its exact `VITE_PAYMENT_SANDBOX_HOST` at build/start time, matching the backend's sandbox host and public-key family. A missing or mismatched host blocks tokenization before any network call. Never place private keys or card data in frontend environment variables. The payment origin must permit the browser origin through CORS; this and live sandbox tokenization have not been verified here.

For a separate HTTPS API origin, set the **public** `VITE_API_BASE_URL` at build time (see [.env.example](.env.example)). Leave it unset for the local proxy. A separate origin also requires backend CORS and browser security-policy configuration before deployment; those are not established by this frontend setup. A `503` from `/checkout/consents` prevents continuation and exposes a retry action; configure the backend rather than bypassing the consents. Do not put server secrets in `VITE_*` variables.

## Verify

Run from `frontend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:coverage
```

Observed locally on 2026-09-27 for the catalog-to-summary frontend: build and lint passed; Jest passed **10 suites / 70 tests**. Coverage was **93.00% statements, 88.52% branches, 95.62% functions, and 95.17% lines**. Tests exercise encrypted-payload serialization at the provider boundary, consent gating, error/retry, duplicate-submit prevention, summary re-quote, no checkout POST, and safe refresh recovery. The Vite-only API-origin configuration is mocked in Jest and has no direct Jest coverage. These figures describe the partial frontend, **not** the completed five-step checkout or live provider behavior.

The earlier single-product screen was visually checked in the in-app browser at desktop width and in Brave at `375 × 667` and `320 × 568` CSS pixels. Those checks used a disposable local API stub, not the real backend. Narrow/desktop/keyboard QA of the current modal and summary, as well as live provider CORS and sandbox tokenization, is still pending; Jest does not substitute for those checks.
