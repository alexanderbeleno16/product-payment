# Frontend checkout

React, TypeScript, Vite, and Redux Toolkit power the mobile-first checkout SPA. **Current scope (catalog and product selection):** the Spanish (Colombia) ShopiFast catalog reads the product list from `GET /products`, offers a breadcrumb back from a selected product, and lets the buyer choose one in-stock quantity for a server-priced quote. Loading, empty, error, retry, and sold-out states are shown. A background catalog refresh keeps the previously loaded cards visible and warns when those details may be stale after a failed refresh; selecting a product always fetches its current detail by ID. The API remains authoritative for product names, descriptions, prices, stock, and quotes; the frontend does not decide payment success.

The catalog presents ten seeded demo products in a responsive grid, but checkout still handles **one selected product at a time**; it has no cart or multi-item payment. Selection resets the previous product, quantity, quote, and pending request identities before fetching the chosen product by ID. Product photos and the store mark are local, optimized assets under `public/`. Images are not stored in PostgreSQL or served by the product API; an unknown catalog product shows a neutral image-unavailable state rather than the wrong product photo. Each seeded product has two local WebP views in a product-ID manifest; the detail gallery supports arrows, thumbnails, and a full-viewport modal with keyboard navigation, Escape, and focus restoration. In the catalog, the first two visible-list images load eagerly (the first with high fetch priority) and later images are lazy-loaded with reserved intrinsic dimensions. On the selected product, both images load eagerly through the thumbnails so the full view uses the same URLs. This optimizes likely first paint and image reuse but is not a production latency measurement. The ShopiFast wordmark uses a self-hosted Grand Hotel font from `@fontsource/grand-hotel` (OFL-1.1), scoped to the brand text; no font CDN is needed.

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

Observed locally on 2026-09-27 for the ten-product frontend: build and lint passed; Jest passed **5 suites / 38 tests**. Coverage was **92.87% statements, 86.44% branches, 96.34% functions, and 94.35% lines**. The Vite-only API-origin configuration is mocked in Jest and has no direct Jest coverage. These figures describe the partial frontend, **not** the completed five-step checkout or its final coverage target.

The earlier single-product screen was visually checked in the in-app browser at desktop width and in Brave at `375 × 667` and `320 × 568` CSS pixels. At both mobile sizes, the document had no horizontal overflow, the fixed checkout action remained reachable, quantity 1 → 2 updated the server-priced subtotal, and the temporary second step displayed Spanish copy. No relevant browser console errors were observed. Those checks used a disposable local API stub, not the real backend. Recheck the ten-product grid, full-screen gallery, and image loading at narrow and wide viewports against a current ten-product API before claiming those outcomes for this version.
