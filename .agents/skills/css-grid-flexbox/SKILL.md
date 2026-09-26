---
name: css-grid-flexbox
description: "Trigger: CSS Grid, Flexbox, layout, alignment, responsive CSS. Choose layout primitives for the React SPA without brittle positioning."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when arranging page regions, product details, forms, actions, cards, or responsive components.
Read the relevant part of the [layout field guide](references/field-guide.md) before choosing Grid, Flexbox, intrinsic sizing, or reordering.

## Hard Rules
- Prefer normal document flow. Use Grid for row-and-column relationships and Flexbox for one-axis distribution.
- Keep source order meaningful for reading and keyboard navigation; visual reordering must not hide a broken DOM order.
- Use `gap`, flexible tracks, `minmax()`, wrapping, and sensible minimum widths before fixed pixel coordinates.
- Avoid absolute positioning for primary layout and avoid width assumptions that cause narrow-screen overflow.
- Do not use CSS visual order to contradict semantic DOM/focus order; protect reduced-motion and zoom behavior when styling interactions.

## Decision Gates
| Relationship | Choice |
| --- | --- |
| Two-dimensional page or card regions | Grid. |
| One-dimensional action row or stack | Flexbox. |
| Content already flows correctly | No layout abstraction. |
| Child refuses to shrink | Check min-content sizing, `min-width: 0`, wrapping, and media constraints before adding overflow hacks. |
| Sticky summary or action needed | Check viewport height, keyboard, and scroll containment before relying on `position: sticky`. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Preserve semantic source order
- R02 — Use Grid for related tracks
- R03 — Use Flexbox for one axis
- R04 — Diagnose intrinsic sizing before hiding overflow
- R05 — Prefer spacing primitives over positional hacks
- R06 — Keep media inside tracks
- R07 — Design sticky elements with scroll reality
- R08 — Respect logical direction and text growth
- R09 — Keep responsive rules local and explainable
- R10 — Verify both visual and interaction order

## Execution Steps
1. Identify semantic DOM/source order and the real one- or two-dimensional relationship.
2. Choose normal flow, Flexbox, or Grid at the smallest useful container; avoid framework-like layout abstractions by habit.
3. Add intrinsic/flexible sizing, then stress with long content, validation errors, media, and zoom.
4. Verify narrow/wide rendering, scroll behavior, source/focus order, and cross-browser layout.

## Output Contract
Report why each primitive was chosen, overflow/root-cause findings, source-order integrity, and the viewport/content cases checked.

## References
Read the local [layout field guide](references/field-guide.md) with MDN source links; use the [shared source map](../_shared/sources.md) for adjacent responsive guidance.
