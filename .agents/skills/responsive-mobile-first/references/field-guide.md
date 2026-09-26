# Mobile-first responsive field guide

The brief asks for a mobile-oriented SPA that also works at larger sizes and across browsers. Treat the iPhone SE (2020) as a named reference, but distinguish **physical screenshot resolution** from the **CSS viewport** reported by a browser; verify the actual viewport in the test tool instead of assuming `1334 × 750` is a CSS-pixel layout target.

## Priority map

| Priority | Concern | Required evidence |
| --- | --- | --- |
| Critical | No clipped checkout actions or horizontal overflow | Every flow state at narrow width. |
| High | Keyboard, zoom, and dynamic content | Form errors, dialog, focused input, long text. |
| High | Responsive media and performance | Rendered dimensions and transferred asset size. |
| Medium | Browser differences | At least two browsers, with named versions when available. |

### R01 — Build the base layout for the narrowest useful viewport

Start with one readable column and normal document flow. Widen only when content and hierarchy benefit. Do not start with fixed desktop columns and attempt to shrink them by hiding information. Keep product, total, shipping, and primary action available in a clear reading order.

### R02 — Let content choose breakpoints

Use `min-width` media queries when the layout genuinely has room for another column or wider spacing. A breakpoint is a response to content pressure, not a label for a phone model. Test widths just below and above each breakpoint to catch discontinuities.

```css
.checkout { display: grid; gap: 1rem; }
@media (min-width: 48rem) {
  .checkout { grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr); }
}
```

The example is a design pattern, not a mandatory breakpoint or final UI specification.

### R03 — Solve overflow at its source

Inspect long product names, untranslated strings, error messages, tables, input values, and image intrinsic widths. Use `min-width: 0` on grid/flex children when needed, sensible wrapping, and `max-width: 100%` for media. Avoid global overflow hiding: it can conceal controls and make debugging harder.

### R04 — Keep the viewport configuration honest

Ensure the page has a responsive viewport meta tag. Do not disable zoom or force a fixed-width viewport to make a screenshot pass. Check browser text-size settings and 200% zoom because they can turn a comfortable desktop arrangement into a narrow one.

### R05 — Design for dynamic height, not just width

The virtual keyboard, browser bars, landscape orientation, and validation copy change available height. A modal/backdrop must permit content scrolling while retaining a reachable action and visible focus. Do not rely on a fixed pixel height that clips fields or buttons.

### R06 — Preserve interaction order

CSS can visually rearrange blocks while DOM and keyboard order stay unchanged. Keep DOM order meaningful in the base layout and avoid using `order` or explicit grid placements to hide a broken sequence. Test keyboard movement through product selection, quantity, shipping, payment, status, and dialogs.

### R07 — Size and load media intentionally

Use aspect ratio or intrinsic dimensions to reserve image space. Supply appropriately sized/compressed assets; avoid downloading a huge desktop image only to display a thumbnail. Check both visual bounds and network transfer size, especially on a slow mobile connection.

### R08 — Test all semantic states

Do not test only the happy-path first screen. Include loading skeleton/placeholder, empty stock, validation errors, long address, payment pending, failure/retry, confirmation, and restored progress. Changes in quantity and errors must not push actions outside the viewport.

### R09 — Verify more than one browser

Use a small matrix that names browser, viewport CSS dimensions, orientation, and flow states. Emulation is useful but not identical to a physical device; disclose which was used. Include at least one browser engine beyond the default when feasible. A passing build or unit suite is not cross-browser evidence.

## Review checklist

- What exact CSS viewport and browser were tested for the small-screen reference?
- Do all checkout states fit without horizontal scrolling or concealed actions?
- Are forms usable with zoom, long text, and an on-screen keyboard?
- Does the dialog/backdrop keep focus and actions reachable?
- Are images appropriately sized and free of avoidable layout shift?
- Is cross-browser support based on observed interaction, not only CSS syntax?

## Primary sources

- [MDN: Responsive web design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design)
- [MDN: Media queries](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Media_queries)
- [MDN: Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)
- [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)
