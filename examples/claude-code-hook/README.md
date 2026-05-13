# Claude Code → Ops Command Center

A Claude Code hook that streams your real Claude sessions into the
ops-command-center dashboard. Every time you run Claude Code, the hook
opens a session, records each tool call with latency, and closes the
session when you stop.

## 1. Mint a token

In the dashboard → **Settings → Tokens → New API token**. Pick:

- `sessions.write` — open / update / close sessions
- `tool-calls.write` — record each tool invocation

Copy the raw `ops_live_…` value shown once on creation.

## 2. Install the hook (one-time)

From the repo root:

```bash
pnpm install
```

That makes the `ops-claude-hook` script resolvable through pnpm's
workspace. The script entry is `examples/claude-code-hook/bin/hook.mjs`.

## 3. Wire it into Claude Code

Edit `~/.claude/settings.json` (or a project-level `.claude/settings.json`
to scope it to one repo). Add a `hooks` block:

```json
{
  "env": {
    "OPS_BASE_URL": "http://localhost:3000",
    "OPS_TOKEN": "ops_live_paste-your-token-here",
    "OPS_OPERATOR": "you@example.com"
  },
  "hooks": {
    "SessionStart": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ],
    "PreToolUse": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ],
    "PostToolUse": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node /absolute/path/to/ops-command-center/examples/claude-code-hook/bin/hook.mjs" }] }
    ]
  }
}
```

Replace the absolute path with where you cloned this repo. Restart
Claude Code so it picks up the settings change.

## 4. Use Claude Code

Run any Claude Code session. Within a second of the first tool call,
**Live** will show your session in the active column with NOW PLAYING
reflecting the current step. **Sessions** lists each session, and
clicking through shows the full tool-call timeline. **Audit log** gets
chain entries for every action.

## What gets recorded

| Claude Code event | Ops endpoint | Effect |
|---|---|---|
| `SessionStart` | `/api/ingest/session/start` | New session row, repo guessed from cwd |
| `UserPromptSubmit` | `/api/ingest/session/update` | NOW PLAYING `step` becomes `prompt · <text>` |
| `PreToolUse` | (state only) | Records start time keyed by `tool_use_id` |
| `PostToolUse` | `/api/ingest/tool-call` + `/session/update` | Tool call row with real latency, session `tool_calls` count + `runtime_s` bumped |
| `Stop` / `SessionEnd` | `/api/ingest/session/end` | Outcome = `success`, final `runtime_s` |

State is per-session in `$TMPDIR/ops-claude-hook/`. PreToolUse writes
a start time, PostToolUse reads + deletes it. Restart-safe — orphan
state files are harmless.

## Debugging

Set `OPS_HOOK_DEBUG=1` in the `env` block and check Claude Code's
hook log: each hook invocation prints what it did or why it skipped.

```
[ops-hook] session.start abc123 (anthropic-ops/my-repo)
[ops-hook] tool Bash · 320ms
[ops-hook] tool Read · 80ms
[ops-hook] session.end abc123
```

## Failure mode

A flaky network, expired token, or 401 from `/api/ingest/*` is
silently swallowed (the script always exits 0). The hook will never
break your Claude Code session — if the dashboard goes dark, you keep
working.

To verify it's actually wired up, watch the `audit_events` table or
check Settings → Tokens for the token's `last_used` timestamp.

## Local dev quickstart

```bash
# 1. Start the stack
docker compose up -d --build

# 2. Open http://localhost:3000, sign in (ALLOW_DEV_BYPASS=1 in .env
#    or Google OIDC), mint a token in Settings → Tokens.

# 3. Add the env block + hooks block above to ~/.claude/settings.json
#    pointing at this repo's bin/hook.mjs.

# 4. Run `claude` in any project. Watch /live and /sessions populate.
```
