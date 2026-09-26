---
name: docker-containers
description: "Trigger: Docker, Dockerfile, Compose, container image, build secrets. Package the two apps reproducibly without leaking credentials."
license: MIT
metadata:
  author: product-payment
  version: "1.0"
---

## Activation Contract
Use when adding or reviewing Dockerfiles, Compose files, container builds, or runtime configuration.
Read the [container field guide](references/field-guide.md) before selecting build contexts, image stages, users, secrets, or Compose services.

## Hard Rules
- Use deterministic dependency installation from lockfiles and separate build/runtime stages when useful.
- Exclude `node_modules`, build outputs, credentials, and local caches from the build context.
- Run services as non-root when feasible and include only runtime requirements in final images.
- Never bake secrets into images, build arguments, source, or committed Compose files; use build/runtime secret mechanisms.
- Do not infer that Docker implies ECS, Kubernetes, or any specific cloud deployment; that decision is later.
- Treat the Vite frontend build and the Nest API runtime as different artifacts; define where each is served before writing Dockerfiles.
- Pin reproducible inputs deliberately and inspect the final image, not only a successful local build.

## Decision Gates
| Need | Choice |
| --- | --- |
| Development orchestration | Compose only if it improves local reproducibility. |
| Production image | Multi-stage, minimal runtime, non-root, health verification. |
| Build-time credential | Docker build secret, never `ARG`/`ENV` with a real secret. |
| Frontend SPA | Build static assets; choose serving strategy explicitly rather than running Vite's dev server in production. |
| API runtime | Start the compiled Nest output with production dependencies/config and a non-root user when feasible. |

### Deep rule index

The [field guide](references/field-guide.md) expands these rules with rationale, examples, failure modes, and a review checklist:

- R01 — Define build contexts for this repository
- R02 — Install deterministically
- R03 — Separate build and runtime artifacts
- R04 — Keep secrets out of layers and browser bundles
- R05 — Run with least privilege
- R06 — Make startup deterministic
- R07 — Use Compose for local orchestration only when useful
- R08 — Inspect the final image and network behavior
- R09 — Keep dependency/security maintenance visible

## Execution Steps
1. Map build context, lockfile, Node version, frontend asset serving, and backend runtime entry point.
2. Design `.dockerignore`, deterministic install, build/runtime stages, least-privilege user, and secret boundaries.
3. Build and run local smoke checks without real credentials; exercise health/startup and error behavior.
4. Inspect final image contents, user, ports, and dependency surface; report unverified deployment assumptions.

## Output Contract
Report build contexts, image/runtime decisions, exact smoke commands, final-image inspection, secret handling, and deployment assumptions.

## References
Read the local [container field guide](references/field-guide.md) with Docker sources; see the [shared source map](../_shared/sources.md).
