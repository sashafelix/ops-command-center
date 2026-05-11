# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/web — production image
# =============================================================================
# One image, two compose roles:
#   - service `web`       (long-running)  CMD: pnpm start         → next start
#   - service `migrator`  (one-shot)      command: pnpm db:migrate → tsx migrate.ts
# Build context is the repo root (compose passes `context: .`) so we can copy
# the full pnpm workspace.
# =============================================================================

ARG NODE_IMAGE=node:20-alpine

# ---- base: pnpm via corepack -----------------------------------------------
FROM ${NODE_IMAGE} AS base
# libc6-compat covers a handful of native deps (esbuild, postgres-js …) that
# expect glibc-style symbols on alpine.
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm --version
WORKDIR /repo

# ---- deps: install workspace dependencies ---------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder: build the Next app ------------------------------------------
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Next.js statically analyses env at build time. AUTH_SECRET is required by
# Auth.js v5 even for SSG/SSR analysis; supply a placeholder so the build
# succeeds. The real value is injected at runtime by compose.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    AUTH_SECRET=build-time-placeholder
RUN pnpm -F @ops/web build

# ---- runner: production image ---------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy the entire built workspace. Keeping the workspace intact (rather than
# extracting just the standalone bundle) lets the same image also run
# `pnpm db:migrate` / `pnpm db:seed` via tsx + drizzle-kit.
COPY --from=builder --chown=node:node /repo /repo
WORKDIR /repo/apps/web

USER node
EXPOSE 3000
CMD ["pnpm", "start"]
