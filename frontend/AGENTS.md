# Frontend agent instructions

These instructions apply to `frontend/` and its descendants. Inherit the repository-root `AGENTS.md`; this file adds SPA-specific guidance rather than replacing it.

## Current baseline

- The application is a React + TypeScript client-rendered SPA scaffolded with Vite. Do not assume Next.js, server components, routing, Redux Toolkit, or a frontend test runner is already configured.
- Keep the scaffold-only phase intact until application behavior is explicitly authorized. Confirm new dependencies and architecture against the actual project state before using them.

## Working rules

- Read the task-matching project skill and its `references/field-guide.md` before implementing or reviewing that topic. The main starting points are [React](../.agents/skills/react-spa-best-practices/SKILL.md), [shared state](../.agents/skills/redux-toolkit-flux/SKILL.md), [responsive design](../.agents/skills/responsive-mobile-first/SKILL.md), [layout](../.agents/skills/css-grid-flexbox/SKILL.md), [accessibility](../.agents/skills/accessibility-ui/SKILL.md), and [Jest](../.agents/skills/jest-frontend-backend/SKILL.md).
- Keep component rendering pure and state at its narrowest useful owner. If shared checkout state warrants Redux Toolkit, add and configure it deliberately; the scaffold does not include it yet.
- Treat the API as authoritative for prices, available stock, and payment outcome. The UI may choose quantity and show progress, but a local state transition must not be treated as confirmed payment.
- Keep card number, cardholder name, expiry, and security code in transient form state only. Do not persist or log them; a refresh must not restore them. Preserve non-sensitive checkout progress only when its storage policy is explicit.
- Design mobile-first, using semantic forms, visible errors, keyboard/focus behavior, and layouts that do not overflow narrow viewports. Verify images at their actual rendered bounds and loading cost.
- Handle loading, empty, pending, failed, retry, and duplicate-submit states explicitly; avoid assuming every request completes immediately or successfully.

## Verification

- From `frontend/`, run `npm run build` and `npm run lint` for applicable changes. Use `npm run dev` to inspect rendered behavior.
- Add and run Jest frontend tests only after a test runner is actually configured. Do not claim the required coverage threshold from scaffold checks or unconfigured tests.
- For UI changes, inspect narrow and desktop viewports and keyboard operation; report which browsers and devices were actually checked.
