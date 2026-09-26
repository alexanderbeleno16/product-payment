# Docker container field guide

Containerization is a packaging decision, not an AWS deployment choice. This monorepo has a Vite frontend build that produces static assets and a Nest backend build that produces a Node runtime artifact. Determine how each will be served before creating image files.

## Priority map

| Priority | Concern | Failure if ignored |
| --- | --- | --- |
| Critical | No secrets in image/context | Credentials leak into layers or public assets. |
| High | Reproducible build | Local image differs from reviewed source/lockfile. |
| High | Minimal runtime/least privilege | Larger attack surface and avoidable permissions. |
| High | Correct startup and health | Image builds but app cannot serve traffic. |

### R01 — Define build contexts for this repository

Decide whether each app builds from its own directory or a root context. Include only required manifests, lockfiles, source, and configuration. Avoid accidentally copying the other app, `.git`, local caches, `.env`, generated output, or `node_modules`. A `.dockerignore` is part of the design, not an afterthought.

### R02 — Install deterministically

Use lockfiles with `npm ci` for reproducible dependency resolution where compatible with the project. Pin a supported Node base image version/digest deliberately and revisit it for security updates. Avoid unconstrained `latest` when a reviewer needs to reproduce the image.

### R03 — Separate build and runtime artifacts

Build TypeScript/Vite/Nest in a build stage when that reduces runtime dependencies. Copy only the required `dist`/static output and production dependencies into the final image. For a Vite SPA, do not run `vite dev` as a production server; define the chosen static-serving layer and its security-header responsibility.

### R04 — Keep secrets out of layers and browser bundles

Never put real credentials in Dockerfile `ARG`, baked `ENV`, copied `.env`, Compose YAML, or the frontend build. Use Docker build secrets when a build truly requires a credential, and runtime secret injection for server-only values. Check image history and final filesystem if there is any doubt. A frontend variable is public once bundled.

### R05 — Run with least privilege

Prefer a non-root runtime user, minimal writable locations, and only required exposed ports. Do not add broad file permissions to make a build pass. Verify the effective user and that the app can read its runtime artifacts and bind to its configured port.

### R06 — Make startup deterministic

The backend should run compiled output and fail clearly when required configuration is absent. Define an appropriate health/readiness signal for the eventual runtime; do not call a TCP-open port a complete health check if dependencies are required for service. Handle shutdown signals so containers stop cleanly.

### R07 — Use Compose for local orchestration only when useful

Compose can express local frontend/API/database relationships, ports, and environment placeholders. Do not commit real values or pretend Compose is the production deployment architecture. Avoid `depends_on` as a substitute for application readiness/retry logic.

### R08 — Inspect the final image and network behavior

Build each image from a clean context, run with fake/test configuration, check startup logs, HTTP endpoint/static page, effective user, exposed ports, and image contents. If a database or external service is absent, state what was stubbed and which smoke tests remain pending.

### R09 — Keep dependency/security maintenance visible

Rebuild from updated base images and dependencies, review vulnerability findings, and avoid confusing a scanner's clean report with proof of runtime security. Document where TLS and headers are applied; a Dockerfile does not itself make public traffic HTTPS.

## Review checklist

- Does the context exclude secrets, caches, builds, and the unrelated app?
- Can another machine reproduce the image from lockfile and pinned base?
- Does the final image contain only needed artifacts and run non-root when feasible?
- Is the SPA served by a real production static layer, not a development server?
- Are runtime secrets injected only server-side and absent from layers/history?
- Were image startup, health, ports, user, and contents actually inspected?

## Primary sources

- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker build secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Compose environment-variable best practices](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)
