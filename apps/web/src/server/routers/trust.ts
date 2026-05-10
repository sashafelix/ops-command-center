import { desc } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

type TrustKpi = {
  active_threats: number;
  open_investigations: number;
  signed_pct: string;
  policy_violations_24h: number;
};

export const trustRouter = router({
  overview: protectedProcedure.query(async () => {
    const [kpi, threatRows, investigations, evidence] = await Promise.all([
      kvGet<TrustKpi>("trust.kpi", {
        active_threats: 0,
        open_investigations: 0,
        signed_pct: "—",
        policy_violations_24h: 0,
      }),
      db.select().from(schema.threat_buckets),
      db.select().from(schema.investigations).orderBy(desc(schema.investigations.opened_at)),
      db
        .select()
        .from(schema.evidence_events)
        .orderBy(desc(schema.evidence_events.signed_at)),
    ]);

    const byCategory = new Map<string, number[]>();
    for (const r of threatRows) {
      let arr = byCategory.get(r.category);
      if (!arr) {
        arr = new Array<number>(24).fill(0);
        byCategory.set(r.category, arr);
      }
      if (r.hour >= 0 && r.hour < 24) arr[r.hour] = r.value;
    }
    const threats = Array.from(byCategory.entries()).map(([category, values]) => ({
      category,
      values,
      total: Math.round(values.reduce((s, v) => s + v, 0)),
    }));

    return {
      kpi,
      threats,
      investigations: investigations.map((i) => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        session_id: i.session_id ?? "",
        age: ageString(i.opened_at),
        evidence_status: i.evidence_status,
        status: i.status,
      })),
      evidence: evidence.map((e) => ({
        id: e.id,
        session_id: e.session_id,
        kind: e.kind,
        hash: e.hash,
        signed: e.signed,
        ...(e.signed_by ? { signed_by: e.signed_by } : {}),
        at: e.signed_at ? e.signed_at.toISOString().slice(11, 20) : "—",
      })),
    };
  }),
});

function ageString(then: Date): string {
  const ms = Date.now() - then.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
