---
name: accessibility-ui
description: "Trigger: accessibility, a11y, forms, dialogs, keyboard, focus, UI review. Apply WCAG-oriented checks to checkout interactions."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use for frontend interaction design, implementation, tests, or accessibility review.
Read the applicable pattern in the [accessibility field guide](references/field-guide.md), especially forms, dialogs, status messages, and focus transitions in the checkout flow.

## Hard Rules
- Use native controls, labels, headings, and landmarks before ARIA substitutes.
- Make every interactive step keyboard-operable with visible focus and logical order.
- Associate validation errors with fields; communicate status changes without relying only on color.
- In dialogs, move focus inside, keep it contained while open, support dismissal when safe, and restore focus on close.
- Check text contrast and zoom behavior against applicable WCAG 2.2 AA criteria; never claim conformance from an automated scan alone.
- Keep accessibility obligations in every state, not only the initial screen: validation, pending, error, retry, confirmation, and modal/backdrop behavior.

## Decision Gates
| UI pattern | Choice |
| --- | --- |
| Native HTML behavior exists | Use native element. |
| Custom dialog required | Define focus, labeling, escape, and return behavior before styling. |
| Async status changes | Provide an accessible status/error announcement. |
| Payment step opens a modal | Follow WAI-ARIA dialog focus and inert-background behavior; choose initial focus based on risk. |
| Form validation fails | Identify the field, explain the correction, and move focus to a useful summary/field without losing entered safe data. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Start with semantic HTML
- R02 — Give every control a persistent accessible name
- R03 — Connect errors to the right field
- R04 — Make focus transitions intentional
- R05 — Implement a real modal pattern
- R06 — Announce asynchronous states without noise
- R07 — Respect contrast, zoom, and reflow
- R08 — Keep targets usable on touch and keyboard
- R09 — Respect user motion and timing
- R10 — Combine manual and automated tests

## Execution Steps
1. Map semantic landmarks, labels, instructions, errors, status announcements, and focus destinations for each step.
2. Implement native controls first; add ARIA only where native semantics cannot express the behavior.
3. Walk the complete flow by keyboard, at zoom/narrow width, and with a screen reader when available; supplement with automation.
4. Verify dialogs, errors, async status, contrast, and target sizes against relevant WCAG criteria; record gaps honestly.

## Output Contract
Report the keyboard path, focus transitions, dialog and error announcements, relevant WCAG criteria, tested assistive tools, and unresolved gaps.

## References
Read the local [accessibility field guide](references/field-guide.md), W3C links inside it, and the [shared source map](../_shared/sources.md).
