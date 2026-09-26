---
name: readme-technical-documentation
description: "Trigger: README, technical documentation, API guide, data model, deployment notes. Document verified setup and decisions for reviewers."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when writing or updating repository onboarding, API contracts, architecture, test evidence, or deployment documentation.
Read the [documentation field guide](references/field-guide.md) and distinguish current scaffold facts from future checkout design.

## Hard Rules
- Lead with what works now, exact setup commands, prerequisites, and how to verify them.
- Distinguish implemented behavior from planned work; never fabricate public URLs, coverage, cloud resources, or API endpoints.
- Include a data-model explanation and public API documentation or collection link once those artifacts exist.
- Report frontend and backend Jest coverage separately with commands and measured percentages once configured.
- Never include provider branding, real credentials, raw card data, or secret values in repository docs.
- Keep commands, ports, environment variable names, screenshots, and links reproducible and dated when they represent an observed run.
- Explain important tradeoffs and failure/recovery behavior, not only a directory tree or framework list.

## Decision Gates
| Evidence | Documentation |
| --- | --- |
| Verified locally | State command and observed result. |
| Planned but not built | Mark as pending or omit. |
| Externally hosted | Link only after verifying public access. |
| Architecture or API planned | State assumptions and open decisions separately from implemented contracts. |
| Test/coverage claim | Include exact command, app scope, metrics, and date/commit. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Lead with verified current behavior
- R02 — Make setup reproducible
- R03 — Explain architecture by dependency direction
- R04 — Document the data model after it exists
- R05 — Describe public API contracts concretely
- R06 — Show the checkout state model
- R07 — Report testing without inflation
- R08 — Treat deployment as evidence
- R09 — Record security assumptions and residual risk
- R10 — Maintain the document with each work unit

## Execution Steps
1. Identify reviewer goals: install/run, follow checkout, inspect API/data model, verify tests, and open a deployed app.
2. Write concise current-state instructions before design detail; label planned pieces and assumptions.
3. Add architecture, API/error contracts, data-model rationale, security boundaries, and measured verification.
4. Re-run commands and links, inspect public availability, then scan for secrets, brand restrictions, and stale claims.

## Output Contract
Report changed sections, commands/links actually verified, missing evidence, and where planned work is clearly labeled.

## References
Read the local [documentation field guide](references/field-guide.md), the supplied brief, and the [shared source map](../_shared/sources.md). This is a project documentation convention, not a product feature.
