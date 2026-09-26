# Checkout accessibility field guide

Accessibility is behavior across the entire purchase journey. Use WCAG 2.2 AA as the evaluation reference, but report individual observed criteria and tests rather than declaring whole-product conformance from a tool score.

## Priority map

| Priority | Pattern | Main failure mode |
| --- | --- | --- |
| Critical | Form names, instructions, errors | A buyer cannot complete or correct payment. |
| Critical | Keyboard/focus through modal and status changes | A buyer becomes trapped or loses context. |
| High | Semantic status and pending feedback | Async result is invisible to assistive technology. |
| High | Contrast, zoom, target size, reflow | Visible UI is unusable under common adaptations. |

### R01 — Start with semantic HTML

Use a main landmark, useful heading hierarchy, native `<button>`, `<label>`, `<input>`, `<fieldset>`, and `<legend>` where appropriate. A clickable `<div>` needs keyboard and semantic repair that a button already provides. Do not add redundant ARIA roles to native elements.

### R02 — Give every control a persistent accessible name

Associate visible labels programmatically. Placeholder text is not a label. Group related choice controls and distinguish quantity, shipping, and payment instructions. Required-state text should not rely on an asterisk alone.

### R03 — Connect errors to the right field

Use field-level error text tied by `aria-describedby` or the appropriate native relationship, mark invalid controls, and explain how to correct them. A generic red border is insufficient. Preserve non-sensitive entries when validation fails. For multiple errors, consider a focused summary linked to fields.

### R04 — Make focus transitions intentional

On screen change, error, confirmation, or status update, decide where focus should move or whether an announcement suffices. Avoid replacing a focused node without restoring useful focus. Test the actual Tab sequence, not only whether elements have `tabIndex`.

### R05 — Implement a real modal pattern

When a modal opens, move focus inside; keep tab navigation within it and background content inert. Escape normally closes a dismissible dialog; do not offer dismissal that silently abandons a critical payment action. Restore focus to the opener when closing unless the workflow legitimately moves elsewhere. The initial focus for an irreversible financial confirmation may favor the least destructive action.

### R06 — Announce asynchronous states without noise

Use a status region for pending/result messages when the change is not otherwise focused. Make announcements concise and avoid repeatedly re-announcing a polling status on every request. Distinguish `pending`, `confirmed`, `failed`, and `unknown`; do not use success-colored text as the only signal.

### R07 — Respect contrast, zoom, and reflow

Check WCAG 2.2 AA contrast for text and essential non-text UI, visible focus, and usable reflow/zoom. Avoid disabling user scaling. Test long translated labels, validation text, and screen magnification, not just the default design file.

### R08 — Keep targets usable on touch and keyboard

Give controls sufficient size and spacing under the applicable WCAG target-size criterion. Ensure hover-only information is reachable via focus and touch. Do not make the backdrop the only way to close a modal.

### R09 — Respect user motion and timing

Avoid motion required to understand a state; support reduced-motion preferences for nonessential animation. Do not make a transient toast the only source of a payment result. If a step times out, provide a recoverable explanation and status recheck path.

### R10 — Combine manual and automated tests

Automated tools catch some label, contrast, and role failures; they cannot prove correct focus decisions, comprehension, or a complete checkout journey. Run keyboard-only, zoom/reflow, and screen-reader-relevant checks on product, form, modal, pending, failure, retry, and success states. Record tool/browser used and any untested criterion.

## Review checklist

- Can the buyer complete every step without a pointer?
- Do labels, instructions, and errors identify each field and correction?
- Does focus enter, stay within, and leave dialogs correctly?
- Are pending/result updates announced once and accurately?
- Are contrast, zoom, narrow viewport, and target sizes verified?
- Is the conformance claim limited to evidence actually gathered?

## Primary sources

- [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [WAI-ARIA Authoring Practices: modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/)
