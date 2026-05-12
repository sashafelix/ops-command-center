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
cp .env.example apps/web/.env.local       # for apps/web
cp .env.example apps/realtime/.env        # for apps/realtime
# Minimum to boot:
#   AUTH_SECRET, REALTIME_JWT_SECRET, DATABASE_URL
# Optional (production sign-in): AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# Bring up Postgres (containerized via compose.yaml)
docker compose up -d postgres

# Apply migrations + load the demo dataset (idempotent)
pnpm -F @ops/web db:migrate
pnpm -F @ops/web db:seed

# Start the apps with hot reload
pnpm dev   # runs apps/web (3000) and apps/realtime (4001) concurrently
```

Open http://localhost:3000 — you'll be bounced to `/login`. Sign in with Google,
or in development pick a role under "Continue without OIDC".

## Scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`                   | Run all workspace `dev` scripts in parallel  |
| `pnpm build`                 | Build every workspace package                |
| `pnpm typecheck`             | `tsc --noEmit` across the workspace          |
| `pnpm lint`                  | ESLint across the workspace                  |
| `pnpm test`                  | Vitest across the workspace                  |
| `pnpm -F @ops/web db:generate` | Diff schema → emit a new SQL migration     |
| `pnpm -F @ops/web db:migrate`  | Apply pending migrations against `DATABASE_URL` |
| `pnpm -F @ops/web db:seed`     | Truncate + reload the demo dataset (idempotent) |
| `pnpm -F @ops/web db:studio`   | Open Drizzle Studio against the dev database |

## Sign-in

In production builds (`NODE_ENV=production`), the dev credentials bypass is
unregistered and Google OIDC is the only way in. Two paths to make `/login`
work:

### Quick path — `ALLOW_DEV_BYPASS=1` (single-operator, local/VPN only)

Re-enables the credentials bypass on a production build. Lets you sign in as
any role without setting up OIDC. **Only safe when access is restricted**
(local network, Tailscale, VPN) — anyone who can reach the URL becomes admin.

```bash
# in .env
ALLOW_DEV_BYPASS=1
```

`docker compose up -d web` and `/login` will show the role picker. A loud
yellow banner stays pinned to the top of every page so you don't forget
it's on.

### Proper path — Google OIDC

1. Go to <https://console.cloud.google.com/apis/credentials>. Create a project
   if you haven't already.
2. **OAuth consent screen** → User type **External** → fill the basics. While
   the app is unpublished, only listed **Test users** can sign in.
3. **Credentials** → **Create credentials** → **OAuth client ID** → Web app.
4. Add the callback URL under **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - VPS:   `https://your-domain/api/auth/callback/google`
5. Copy the Client ID + secret into `.env`:
   ```bash
   AUTH_GOOGLE_ID=<client-id>
   AUTH_GOOGLE_SECRET=<client-secret>
   ALLOW_DEV_BYPASS=         # blank — turn the bypass off
   ```
6. `docker compose up -d web`.

New Google sign-ins land as `viewer`. Promote yourself by editing the
`members` table directly (until the role-management UI lands).

## Deploy to a single VPS

Everything ships as containers. One `docker compose up` brings up Postgres, the
Next.js web app, the realtime WS worker, and a one-shot migrator that applies
pending Drizzle migrations before web boots.

```bash
# 1. Configure secrets (one-time, on the server)
cp .env.example .env
# Fill in at minimum:
#   AUTH_SECRET           openssl rand -base64 32
#   REALTIME_JWT_SECRET   openssl rand -base64 32
#   SYNC_SECRET           openssl rand -base64 32
#   AUTH_URL              public origin (e.g. https://ops.example.com)
# Optional:
#   AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET   Google OIDC sign-in
#   PROXMOX_TOKEN / ANTHROPIC_API_KEY / GITHUB_TOKEN   per-connector secrets

# 2. Build + boot
docker compose up -d --build

# 3. Load demo data (optional, idempotent)
docker compose exec web pnpm db:seed
```

Compose brings services up in the right order via health-gated `depends_on`:
`postgres` → `migrator` (runs, exits 0) → `web` → `realtime`. Migrations re-run
on every restart (Drizzle's `__drizzle_migrations` table is the authority, so
this is safe and idempotent).

Operational basics:

```bash
docker compose ps                            # status + health
docker compose logs -f web realtime          # tail logs
docker compose exec web pnpm db:migrate      # re-run migrations explicitly
docker compose exec web pnpm db:seed         # reset demo data
docker compose pull && docker compose up -d --build   # update + redeploy
```

**Reverse proxy notes.** In production the browser talks to two ports —
`:3000` for HTTP and `:4001` for the WS upgrade. Terminate TLS in front (Caddy,
Nginx, Traefik) and proxy both. The relevant headers:

- `Upgrade`, `Connection: upgrade` for `:4001`
- Set `AUTH_URL` to the public HTTPS origin so Auth.js issues correct callbacks
- Set `NEXT_PUBLIC_REALTIME_URL` to `wss://your-domain/ws` (or wherever you
  expose the WS port)

**Image layout.** A single `apps/web/Dockerfile` produces the image that runs
both the `web` long-running service and the `migrator` one-shot — the latter
just invokes `pnpm db:migrate` instead of `pnpm start`. `apps/realtime` has its
own image. Both bake pnpm into the layer so containers start without a corepack
download.

## Design language

Tokens are lifted from `Reference_Folder/Ops Dashboard.html` into
`apps/web/src/styles/tokens.css` (CSS variables) and surfaced via Tailwind in
`apps/web/tailwind.config.ts`. Geist Sans + Geist Mono via the `geist` package.
Borders only — no shadows. One signal color per status (ok / warn / bad / info /
violet), always paired with a label. See HANDOFF §3 for the full bible.

## Source of truth

- `Reference_Folder/HANDOFF.md` — IA, data model, RBAC, realtime strategy, acceptance
- `Reference_Folder/Ops Dashboard.html` — visual + interaction spec
