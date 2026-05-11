# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/realtime — production image
# =============================================================================
# Standalone Node WS server. Runs `tsx src/index.ts` against the workspace
# install — no separate build step needed (no TS emit beyond typecheck).
# Build context is the repo root (compose passes `context: .`).
# =============================================================================

ARG NODE_IMAGE=node:20-alpine

# ---- base: pnpm via corepack -----------------------------------------------
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm --version
WORKDIR /repo

# ---- deps: workspace install ----------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- runner ---------------------------------------------------------------
FROM deps AS runner
ENV NODE_ENV=production \
    REALTIME_HOST=0.0.0.0 \
    REALTIME_PORT=4001

# Source for the realtime worker + the shared workspace package it imports.
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/realtime ./apps/realtime

# pnpm's workspace symlink from apps/realtime/node_modules/@ops/shared
# → packages/shared was already created during the deps install.

WORKDIR /repo/apps/realtime

# Run as the unprivileged node user that ships in node:alpine. We deliberately
# DO NOT chown /repo: a recursive chown of a workspace this size produces a
# multi-hundred-MB extra layer (Docker stores the changed inodes as a delta).
# The node user can read root-owned files fine — the realtime worker only
# reads at runtime.
USER node
EXPOSE 4001
CMD ["pnpm", "start"]
