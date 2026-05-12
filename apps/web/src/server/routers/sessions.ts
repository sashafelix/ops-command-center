import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

type Tone = "ok" | "warn" | "bad" | "idle";

type ActiveCard = {
  id: string;
  status: Tone;
  agent: string;
  model: string;
  repo: string;
  goal: string;
  runtime_s: number;
  cost_usd: number;
  tools: number;
  trust_score: number;
  step: string;
  spark: number[];
  pinned: boolean;
  hot: boolean;
};

type WatchingCard = ActiveCard & { reason: string };

type DoneRow = {
  id: string;
  status: Tone;
  goal: string;
  agent: string;
  cost_usd: number;
  tools: number;
  duration: string;
  when: string;
  trust_score: number;
};

type LiveBoard = {
  counts: { active: number; watching: number; done1h: number };
  active: ActiveCard[];
  watching: WatchingCard[];
  done: DoneRow[];
};

type SessionsTableRow = {
  id: string;
  status: Tone;
  agent: string;
  model: string;
  goal: string;
  duration: string;
  cost_usd: number;
  tools: number;
  trust_score: number;
  when: string;
};

type ReceiptTimelineStep = {
  t: string;
  kind: string;
  name: string;
  cost_usd: number;
  latency_ms: number;
  note: string;
  current?: boolean;
};

type ReceiptArtifact = { kind: string; name: string; delta: string; bytes: string };
type ReceiptSignal = {
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad" | "info";
  note: string;
};

type Receipt = {
  id: string;
  agent: string;
  model: string;
  repo: string;
  branch: string;
  operator: string;
  started_at: string;
  runtime_s: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  tools: number;
  trust_score: number;
  outcome: "in-progress" | "success" | "aborted" | "failed";
  goal: string;
  timeline: ReceiptTimelineStep[];
  artifacts: ReceiptArtifact[];
  signals: ReceiptSignal[];
};

/**
 * Live-board "done in the last hour" window. The seed inserts done rows
 * with started_at = now() - 1h, so this window captures the seed by design.
 */
const DONE_WINDOW = "1 hour";

/** Cap on the sessions list payload so a long-running install doesn't
 *  ship megabytes of rows on every poll. The virtualized table handles
 *  smaller windows just fine; older rows can be filtered to via /audit-log
 *  or future server-side pagination. */
const SESSIONS_LIST_LIMIT = 500;

export const sessionsRouter = router({
  /**
   * Live board — three columns + counts, all computed from the sessions
   * table. Was previously a static kvGet of "live.board" that never
   * reflected anything beyond the seed.
   *
   *   - active:   outcome='in-progress' AND extra.phase='active'
   *   - watching: outcome='in-progress' AND extra.phase='watching'
   *   - done:     outcome != 'in-progress' AND started_at within the
   *               last DONE_WINDOW
   */
  liveBoard: protectedProcedure.query(async (): Promise<LiveBoard> => {
    const doneSince = sql`now() - interval ${sql.raw(`'${DONE_WINDOW}'`)}`;

    const [activeRows, watchingRows, doneRows] = await Promise.all([
      db
        .select()
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.outcome, "in-progress"),
            sql`(${schema.sessions.extra}->>'phase') = 'active'`,
          ),
        )
        .orderBy(
          sql`((${schema.sessions.extra}->>'pinned')::boolean) DESC NULLS LAST`,
          sql`((${schema.sessions.extra}->>'hot')::boolean) DESC NULLS LAST`,
          desc(schema.sessions.started_at),
        ),
      db
        .select()
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.outcome, "in-progress"),
            sql`(${schema.sessions.extra}->>'phase') = 'watching'`,
          ),
        )
        .orderBy(desc(schema.sessions.started_at)),
      db
        .select()
        .from(schema.sessions)
        .where(
          and(
            ne(schema.sessions.outcome, "in-progress"),
            gte(schema.sessions.started_at, doneSince),
          ),
        )
        .orderBy(desc(schema.sessions.started_at)),
    ]);

    return {
      counts: {
        active: activeRows.length,
        watching: watchingRows.length,
        done1h: doneRows.length,
      },
      active: activeRows.map(toActiveCard),
      watching: watchingRows.map(toWatchingCard),
      done: doneRows.map(toDoneRow),
    };
  }),

  /**
   * Sessions list — all rows ordered newest first. Capped at
   * SESSIONS_LIST_LIMIT so the response stays bounded; older rows are
   * findable via /audit-log filters today and via real pagination later.
   */
  list: protectedProcedure.query(async (): Promise<SessionsTableRow[]> => {
    const rows = await db
      .select()
      .from(schema.sessions)
      .orderBy(desc(schema.sessions.started_at))
      .limit(SESSIONS_LIST_LIMIT);
    return rows.map(toTableRow);
  }),

  /**
   * Session detail receipt.
   *
   * Real read from sessions + tool_calls, with a fallback to the seeded
   * `sessions.receipt` KV blob for the specific demo id that ships with a
   * hand-crafted timeline + artifacts + signals. Ingest-written sessions
   * always go through the DB path and render whatever tool_calls have
   * accumulated.
   */
  detail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }): Promise<Receipt> => {
      const seeded = await kvGet<Receipt | null>("sessions.receipt", null);
      if (seeded && seeded.id === input.id) return seeded;

      const [row] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, input.id))
        .orderBy(desc(schema.sessions.started_at));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const calls = await db
        .select()
        .from(schema.tool_calls)
        .where(eq(schema.tool_calls.session_id, row.id))
        .orderBy(schema.tool_calls.t_offset_ms);

      return {
        id: row.id,
        agent: row.agent_version,
        model: row.model,
        repo: row.repo,
        branch: row.branch ?? "—",
        operator: row.operator,
        started_at: row.started_at.toISOString(),
        runtime_s: row.runtime_s,
        cost_usd: row.cost_usd,
        tokens_in: row.tokens_in,
        tokens_out: row.tokens_out,
        tools: row.tool_calls,
        trust_score: row.trust_score,
        outcome: row.outcome,
        goal: row.goal,
        timeline: calls.map((c) => ({
          t: msToOffset(c.t_offset_ms),
          kind: c.kind,
          name: c.name,
          cost_usd: c.cost_usd,
          latency_ms: c.latency_ms,
          note: c.note ?? "",
        })),
        artifacts: [],
        signals: [],
      };
    }),
});

// =============================================================================
// row → view helpers
// =============================================================================

type SessionRow = typeof schema.sessions.$inferSelect;

function tone(status: string): Tone {
  if (status === "ok" || status === "warn" || status === "bad" || status === "idle") return status;
  return "idle";
}

function toActiveCard(r: SessionRow): ActiveCard {
  const extra = (r.extra ?? {}) as {
    step?: string;
    spark?: number[];
    pinned?: boolean;
    hot?: boolean;
  };
  return {
    id: r.id,
    status: tone(r.status),
    agent: r.agent_version,
    model: r.model,
    repo: r.repo,
    goal: r.goal,
    runtime_s: r.runtime_s,
    cost_usd: r.cost_usd,
    tools: r.tool_calls,
    trust_score: r.trust_score,
    step: extra.step ?? "",
    spark: Array.isArray(extra.spark) ? extra.spark : [],
    pinned: extra.pinned === true,
    hot: extra.hot === true,
  };
}

function toWatchingCard(r: SessionRow): WatchingCard {
  const base = toActiveCard(r);
  const extra = (r.extra ?? {}) as { reason?: string };
  return { ...base, reason: extra.reason ?? "" };
}

function toDoneRow(r: SessionRow): DoneRow {
  const extra = (r.extra ?? {}) as { duration?: string; when?: string };
  return {
    id: r.id,
    status: tone(r.status),
    goal: r.goal,
    agent: r.agent_version,
    cost_usd: r.cost_usd,
    tools: r.tool_calls,
    duration: extra.duration ?? fmtDuration(r.runtime_s),
    when: extra.when ?? relTime(r.started_at),
    trust_score: r.trust_score,
  };
}

function toTableRow(r: SessionRow): SessionsTableRow {
  // For in-progress rows the "duration" / "when" labels are wall-clock
  // derived; for completed rows we still prefer the precomputed labels
  // in `extra` when present.
  const extra = (r.extra ?? {}) as { duration?: string; when?: string };
  return {
    id: r.id,
    status: tone(r.status),
    agent: r.agent_version,
    model: r.model,
    goal: r.goal,
    duration: extra.duration ?? fmtDuration(r.runtime_s),
    cost_usd: r.cost_usd,
    tools: r.tool_calls,
    trust_score: r.trust_score,
    when: extra.when ?? relTime(r.started_at),
  };
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function relTime(then: Date): string {
  const ms = Date.now() - then.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function msToOffset(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

