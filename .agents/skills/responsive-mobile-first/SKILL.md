---
name: responsive-mobile-first
description: "Trigger: responsive, mobile-first, small viewport, checkout layout. Design the SPA for narrow screens before wider breakpoints."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use for screen layout, modal/backdrop behavior, forms, or responsive QA in `frontend/`.
Read the [mobile-first field guide](references/field-guide.md) for the flow and viewport matrix; do not treat one screenshot or a desktop browser's narrow window as proof of mobile quality.

## Hard Rules
- Start with a usable narrow-screen layout; add wider layouts only where content needs them.
- Do not fix overflow by hiding content or disabling zoom. Keep controls readable and reachable.
- Use flexible dimensions and content-driven breakpoints rather than targeting a device model alone.
- Verify every checkout step, including errors, keyboard focus, summary, and final status, at narrow and wide widths.
- Include the brief's iPhone SE (2020) reference in viewport testing, and check the complete flow in more than one browser before claiming cross-browser support.
- Preserve source order and focus order while reflowing; keyboard, zoom, long content, and on-screen keyboard are part of responsive behavior.

## Decision Gates
| Layout pressure | Choice |
| --- | --- |
| Content fits naturally | Keep the base layout; no breakpoint. |
| Content becomes cramped | Add a breakpoint where it breaks. |
| Modal exceeds viewport | Constrain and scroll its content while retaining visible actions. |
| Long content causes horizontal scroll | Fix intrinsic sizing, wrapping, or container constraints; do not mask it with global `overflow-x: hidden`. |
| Image dominates the first screen | Use responsive dimensions and appropriate assets; inspect transfer size and layout shift. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Build the base layout for the narrowest useful viewport
- R02 — Let content choose breakpoints
- R03 — Solve overflow at its source
- R04 — Keep the viewport configuration honest
- R05 — Design for dynamic height, not just width
- R06 — Preserve interaction order
- R07 — Size and load media intentionally
- R08 — Test all semantic states
- R09 — Verify more than one browser

## Execution Steps
1. Map every checkout state and its reading/focus order at the narrowest supported CSS viewport.
2. Build the base layout in normal flow with fluid sizing; add content-driven breakpoints only where it breaks.
3. Exercise long text, validation, loading, modal, virtual keyboard, landscape, and zoom before declaring a breakpoint stable.
4. Check overflow, hit areas, image cost, and full interaction in more than one browser; record the viewport sizes and browsers actually tested.

## Output Contract
Report the viewport/browser matrix, flow states tested, overflow and keyboard results, image findings, and remaining device limitations.

## References
Read the local [mobile-first field guide](references/field-guide.md) and its MDN sources; consult the [shared source map](../_shared/sources.md) for related layout and accessibility guidance.
