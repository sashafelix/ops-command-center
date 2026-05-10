import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, sreProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

type AgentsKpi = {
  active: number;
  paused: number;
  total: number;
  avg_trust: number;
  deploys_24h: number;
};

export const agentsRouter = router({
  overview: protectedProcedure.query(async () => {
    const [list, deploys, keys, kpi] = await Promise.all([
      db.select().from(schema.agent_versions).orderBy(schema.agent_versions.id),
      db
        .select()
        .from(schema.deploys)
        .where(eq(schema.deploys.target_kind, "agent"))
        .orderBy(desc(schema.deploys.when)),
      db.select().from(schema.signing_keys),
      kvGet<AgentsKpi>("agents.kpi", {
        active: 0,
        paused: 0,
        total: 0,
        avg_trust: 0,
        deploys_24h: 0,
      }),
    ]);

    return {
      kpi: {
        active: list.filter((a) => a.status === "active").length,
        paused: list.filter((a) => a.status === "paused").length,
        total: list.length,
        avg_trust:
          list.length === 0
            ? 0
            : Number(
                (list.reduce((s, a) => s + a.trust_score, 0) / list.length).toFixed(2),
              ),
        deploys_24h: kpi.deploys_24h,
      },
      list: list.map((a) => ({
        id: a.id,
        version: a.version,
        channel: a.channel,
        status: a.status,
        model: a.model,
        owner: a.owner,
        trust: a.trust_score,
        runs_24h: a.runs_24h,
        cost_24h: a.cost_24h,
        p95_s: a.p95_s,
        tools: a.tools,
        rate_per_min: a.rate_per_min,
        budget: a.budget,
        signed: a.signed,
        drift: a.drift,
        spark: a.spark,
      })),
      deploys: deploys.map((d) => ({
        id: d.id,
        agent: d.service_or_agent_id,
        from: d.from_version ?? "?",
        to: d.version,
        channel: d.channel,
        who: d.who,
        when: ageString(d.when),
        status: d.status,
        eval_delta: d.eval_delta,
        cost_delta: d.cost_delta,
      })),
      keys: keys.map((k) => ({
        fingerprint: k.fingerprint,
        agent: k.agent,
        algo: k.algo,
        sigs_24h: k.sigs_24h,
        last_used: k.last_used ? ageString(k.last_used) : "—",
      })),
    };
  }),

  /** Destructive — SRE+, re-auth, audit-event. */
  rollback: sreProcedure
    .input(z.object({ deploy_id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);
      const [dep] = await db
        .select()
        .from(schema.deploys)
        .where(and(eq(schema.deploys.id, input.deploy_id), eq(schema.deploys.target_kind, "agent")));
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(schema.deploys)
        .set({ status: "rolled-back" })
        .where(eq(schema.deploys.id, input.deploy_id));
      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "agent.rollback",
        target: `deploy/${dep.id}`,
      });
      return { id: dep.id, status: "rolled-back" as const };
    }),
});

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
