# @ops/realtime

Standalone Node 20 WebSocket service. Single connection per browser, multiplexed
by topic (`now-playing`, `sessions`, `evidence`, `notifications`).

Auth on upgrade: web mints a short-lived HS256 JWT with `aud=ops-realtime` /
`iss=ops-web`, web stores it in an HttpOnly cookie OR passes it as `?t=...`
on the WS URL; this service verifies via the shared `REALTIME_JWT_SECRET`.

```bash
pnpm dev      # tsx watch
pnpm start    # one-shot
```

Phase 5 hardens reconnect/cursor-resume; this scaffold sends a `cursor` per event
so the contract is in place.
