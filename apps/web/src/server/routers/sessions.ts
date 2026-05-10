import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

type ActiveCard = {
  id: string;
  status: "ok" | "warn" | "bad" | "idle";
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
  status: "ok" | "warn" | "bad" | "idle";
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
  status: "ok" | "warn" | "bad" | "idle";
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

export const sessionsRouter = router({
  /** Live board: 3 column blobs + counts. */
  liveBoard: protectedProcedure.query(() =>
    kvGet<LiveBoard>("live.board", {
      counts: { active: 0, watching: 0, done1h: 0 },
      active: [],
      watching: [],
      done: [],
    }),
  ),

  /** Sessions list — virtualized on the client. */
  list: protectedProcedure.query(() =>
    kvGet<SessionsTableRow[]>("sessions.table", []),
  ),

  /** Session detail receipt. */
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

function msToOffset(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
