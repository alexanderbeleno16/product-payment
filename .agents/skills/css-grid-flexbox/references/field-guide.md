# CSS Grid and Flexbox field guide

The point is not to use both APIs everywhere; it is to choose the simplest layout model that expresses the content relationship and survives real text, errors, zoom, and narrow screens.

## Decision table

| Relationship | Prefer | Avoid |
| --- | --- | --- |
| Ordinary vertical document | Normal block flow | Grid/Flexbox just to stack elements. |
| One row/column of related controls | Flexbox | Absolute coordinates or manual margins. |
| Two-dimensional regions or aligned tracks | Grid | Nested one-off flex containers that fight alignment. |
| Component has local internal alignment | Local Grid/Flexbox | A page-wide rule coupled to its internals. |

### R01 — Preserve semantic source order

Place product details, form sections, summary, and action in a DOM order that remains sensible without CSS. `order` and Grid placement only change the visual sequence, not the reading and keyboard sequence. If mobile and desktop need genuinely different order, revisit information architecture rather than relying on CSS reordering alone.

### R02 — Use Grid for related tracks

Grid is useful when page regions share row/column structure. Use flexible tracks with minimum constraints rather than fixed widths:

```css
.purchase-layout { display: grid; gap: 1rem; }
@media (min-width: 48rem) {
  .purchase-layout {
    grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
  }
}
```

This is an example of the sizing idea, not a prescribed breakpoint. Check that both columns can contain real labels, errors, and translated text.

### R03 — Use Flexbox for one axis

An action row can use `display: flex`, `gap`, and wrapping. Flex item sizing depends on content, `flex-basis`, grow/shrink, and minimum content width; do not assume `flex: 1` guarantees no overflow. A mobile action row may be clearer as a column rather than squashed buttons.

### R04 — Diagnose intrinsic sizing before hiding overflow

Grid and flex children often retain an automatic minimum size. When a long label or input forces overflow, inspect the specific child and apply `min-width: 0`, wrapping, or bounded media where appropriate. Avoid `overflow-x: hidden` on the document as a substitute for diagnosis; it can conceal off-screen controls.

### R05 — Prefer spacing primitives over positional hacks

Use `gap` for relationships within a container, and padding for container edges. Avoid margin chains that depend on sibling count or absolute positioning of the main action. Reserve absolute positioning for decorative overlays or local badges that do not carry essential content.

### R06 — Keep media inside tracks

Give product media a max inline size and a meaningful aspect ratio. A large intrinsic image should not widen a Grid track. Test placeholder, loading, broken image, and long description states. If crop is acceptable, document why; do not crop text or essential product details.

### R07 — Design sticky elements with scroll reality

`position: sticky` is affected by scroll containers and containing blocks. A sticky summary or mobile action can obscure validation errors, focused controls, or the virtual keyboard. Verify with actual scrolling and focus rather than static screenshots; remove stickiness if it harms accessibility.

### R08 — Respect logical direction and text growth

Prefer logical properties where layout should adapt to writing direction. Allow text wrapping and flexible height. Do not hardcode a card height that assumes one-line labels or English-only copy. Zoom and system font changes are layout tests, not edge decorations.

### R09 — Keep responsive rules local and explainable

Put component-specific breakpoints near their layout rules. Use a breakpoint when content breaks, not because a device category name exists. Avoid proliferating overlapping media queries that cannot be reasoned about. Record why each breakpoint exists.

### R10 — Verify both visual and interaction order

Test narrow and wide widths, just below/above breakpoints, long content, errors, zoom, and keyboard navigation. A layout that looks correct but moves focus unpredictably is not complete. Confirm in more than one browser if a feature depends on subtle sizing behavior.

## Review checklist

- Could normal flow replace a Grid/Flexbox container?
- Is every essential region in a useful DOM order without CSS?
- Are tracks allowed to shrink and media prevented from overflowing?
- Are long labels, error messages, zoom, and images included in tests?
- Does any sticky or positioned element obscure focus or actions?
- Does the breakpoint correspond to content pressure rather than a device brand?

## Primary sources

- [MDN: CSS Grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout)
- [MDN: CSS flexible box layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout)
- [MDN: Responsive web design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design)
