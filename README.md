# Ops Command Center

Internal control plane for running, observing, and governing AI-agent fleets.

> **Status:** Phase 1 — Foundation. Chrome shell, auth, theming, Cmd+K, mock tRPC,
> and a real WebSocket service are wired end-to-end. Surface implementations
> (Live, Sessions, Approvals, …) land in subsequent phases per `Reference_Folder/HANDOFF.md`.

## Layout

```
ops-command-center/
├── apps/
│   ├── web/        Next 14 dashboard (App Router, TS strict, Tailwind, shadcn)
│   └── realtime/   Standalone Node 20 + ws service (topic-multiplexed)
└── packages/
    └── shared/     Zod schemas + WS envelope shared by web and realtime
```

## Prerequisites

- Node 20 LTS (the repo's `packageManager` field pins pnpm 9.15.0)
- pnpm 9.x (`npm i -g pnpm@9.15.0` or `corepack enable && corepack use pnpm@9.15.0`)
- A Google OAuth client for OIDC (see `.env.example`)

## Quickstart

```bash
pnpm install

# Configure env (one-time)
cp .env.example .env.local                # for apps/web
cp .env.example apps/realtime/.env        # for apps/realtime

# Edit both files. Minimum to boot:
#   AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, REALTIME_JWT_SECRET

pnpm dev   # runs apps/web (3000) and apps/realtime (4001) concurrently
```

Open http://localhost:3000 — you'll be bounced to `/login`. Sign in with Google,
then the dashboard lands on `/live`.

## Scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`        | Run all workspace `dev` scripts in parallel       |
| `pnpm build`      | Build every workspace package                     |
| `pnpm typecheck`  | `tsc --noEmit` across the workspace               |
| `pnpm lint`       | ESLint across the workspace                       |
| `pnpm test`       | Vitest across the workspace                       |

## Design language

Tokens are lifted from `Reference_Folder/Ops Dashboard.html` into
`apps/web/src/styles/tokens.css` (CSS variables) and surfaced via Tailwind in
`apps/web/tailwind.config.ts`. Geist Sans + Geist Mono via the `geist` package.
Borders only — no shadows. One signal color per status (ok / warn / bad / info /
violet), always paired with a label. See HANDOFF §3 for the full bible.

## Source of truth

- `Reference_Folder/HANDOFF.md` — IA, data model, RBAC, realtime strategy, acceptance
- `Reference_Folder/Ops Dashboard.html` — visual + interaction spec
