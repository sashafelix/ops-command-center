/**
 * Per-surface KV recomputes that run after ingest events land in Postgres.
 * Each helper aggregates over the row store and writes the result back to the
 * appropriate kv_meta key the surface reads via `kvGet`.
 *
 * Volume note: these run inline with the ingest write, which is fine while
 * we're at hundreds of events/min. If volume scales we'll batch them behind a
 * dedicated worker that reads pg_notify and debounces.
 */

import { eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { kvSet } from "@/db/kv";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function recomputeLiveKpi(): Promise<void> {
  const [agg] = await db
    .select({
      spend24h: sql<number>`COALESCE(SUM(${schema.sessions.cost_usd}) FILTER (WHERE ${schema.sessions.started_at} > now() - interval '24 hours'), 0)`,
      spendPrev: sql<number>`COALESCE(SUM(${schema.sessions.cost_usd}) FILTER (WHERE ${schema.sessions.started_at} BETWEEN now() - interval '48 hours' AND now() - interval '24 hours'), 0)`,
      sessions24h: sql<number>`COUNT(*) FILTER (WHERE ${schema.sessions.started_at} > now() - interval '24 hours')`,
      toolCalls24h: sql<number>`COALESCE(SUM(${schema.sessions.tool_calls}) FILTER (WHERE ${schema.sessions.started_at} > now() - interval '24 hours'), 0)`,
      avgTrust: sql<number>`COALESCE(AVG(${schema.sessions.trust_score}) FILTER (WHERE ${schema.sessions.started_at} > now() - interval '24 hours'), 1)`,
    })
    .from(schema.sessions);

  await kvSet("live.kpi", {
    spend24h: Number(agg?.spend24h ?? 0),
    spendPrev: Number(agg?.spendPrev ?? 0),
    sessions24h: Number(agg?.sessions24h ?? 0),
    toolCalls24h: Number(agg?.toolCalls24h ?? 0),
    avgTrust: Number(agg?.avgTrust ?? 1),
    p95LatencyS: 0,
  });
}

export async function recomputeLiveBoard(): Promise<void> {
  const all = await db.select().from(schema.sessions).orderBy(schema.sessions.started_at);
  const active = all.filter((s) => s.outcome === "in-progress" && s.status !== "warn");
  const watching = all.filter((s) => s.outcome === "in-progress" && s.status === "warn");
  const done = all.filter(
    (s) => s.outcome !== "in-progress" && Date.now() - s.started_at.getTime() < DAY_MS,
  );

  const shapeActive = (s: (typeof all)[number]) => {
    const extra = (s.extra ?? {}) as Record<string, unknown>;
    return {
      id: s.id,
      status: s.status,
      agent: s.agent_version,
      model: s.model,
      repo: s.repo,
      goal: s.goal,
      runtime_s: s.runtime_s,
      cost_usd: s.cost_usd,
      tools: s.tool_calls,
      trust_score: s.trust_score,
      step: (extra.step ?? "") as string,
      spark: (extra.spark ?? []) as number[],
      pinned: (extra.pinned ?? false) as boolean,
      hot: (extra.hot ?? false) as boolean,
    };
  };

  const shapeWatching = (s: (typeof all)[number]) => ({
    ...shapeActive(s),
    reason: ((s.extra ?? {}) as Record<string, unknown>).reason as string ?? "",
  });

  const shapeDone = (s: (typeof all)[number]) => ({
    id: s.id,
    status: s.status,
    goal: s.goal,
    agent: s.agent_version,
    cost_usd: s.cost_usd,
    tools: s.tool_calls,
    duration: ((s.extra ?? {}) as Record<string, unknown>).duration as string ?? "—",
    when: ((s.extra ?? {}) as Record<string, unknown>).when as string ?? ageString(s.started_at),
    trust_score: s.trust_score,
  });

  await kvSet("live.board", {
    counts: { active: active.length, watching: watching.length, done1h: done.length },
    active: active.map(shapeActive),
    watching: watching.map(shapeWatching),
    done: done.map(shapeDone),
  });
}

export async function recomputeApprovalsCounts(): Promise<void> {
  const [pending] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.approvals)
    .where(isNull(schema.approvals.decided_at));

  const [{ c: autoApproved } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.approvals)
    .where(eq(schema.approvals.decision, "approve"));

  const [{ c: blocked } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.approvals)
    .where(eq(schema.approvals.decision, "deny"));

  await kvSet("approvals.counts", {
    pending: pending?.c ?? 0,
    autoApproved24h: autoApproved,
    blocked24h: blocked,
  });
}

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
