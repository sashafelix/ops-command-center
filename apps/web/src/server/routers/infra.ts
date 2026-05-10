import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet } from "@/db/kv";

type InfraKpi = { uptime: string; mttr: string; openIncidents: number; slosBreached: number };

export const infraRouter = router({
  overview: protectedProcedure.query(async () => {
    const [kpi, regions, services, load, incidents, deploys, slos] = await Promise.all([
      kvGet<InfraKpi>("infra.kpi", {
        uptime: "—",
        mttr: "—",
        openIncidents: 0,
        slosBreached: 0,
      }),
      db.select().from(schema.regions),
      db.select().from(schema.services).orderBy(schema.services.name),
      db.select().from(schema.service_load),
      db.select().from(schema.incidents).orderBy(desc(schema.incidents.started_at)),
      db
        .select()
        .from(schema.deploys)
        .where(eq(schema.deploys.target_kind, "service"))
        .orderBy(desc(schema.deploys.when)),
      db.select().from(schema.slos),
    ]);

    const byService = new Map<string, number[]>();
    for (const r of load) {
      let arr = byService.get(r.service_id);
      if (!arr) {
        arr = new Array<number>(60).fill(0);
        byService.set(r.service_id, arr);
      }
      if (r.minute >= 0 && r.minute < 60) arr[r.minute] = r.cpu_pct;
    }
    const loadShaped = Array.from(byService.entries()).map(([id, values]) => ({ id, values }));

    return {
      kpi,
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        status: narrowTone(r.status),
        nodes: r.nodes,
        az: r.az,
        cost_per_hour: r.cost_per_hour,
        traffic_pct: r.traffic_pct,
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        stack: s.stack,
        region: s.region,
        status: narrowTone(s.status),
        replicas: s.replicas,
        cpu_pct: s.cpu_pct,
        mem_pct: s.mem_pct,
        rps: s.rps,
        error_pct: s.error_pct,
        p95_ms: s.p95_ms,
        version: s.version,
        ...(s.reason ? { reason: s.reason } : {}),
      })),
      load: loadShaped,
      incidents: incidents.map((i) => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        service_id: i.service_id ?? "",
        age: ageString(i.started_at),
        assignee: i.assignee,
        status: i.status,
      })),
      deploys: deploys.map((d) => ({
        id: d.id,
        version: d.version,
        service: d.service_or_agent_id,
        who: d.who,
        when: ageString(d.when),
        status: tone(d.status),
        rollback_candidate: d.rollback_candidate,
      })),
      slos: slos.map((s) => ({
        id: s.id,
        name: s.name,
        target: s.target,
        actual: s.actual,
        burn_rate: s.burn_rate,
        state: narrowTone(s.state),
      })),
    };
  }),
});

/** services / regions / slos only ever surface ok | warn | bad in v1. */
function narrowTone(t: "ok" | "warn" | "bad" | "info" | "violet"): "ok" | "warn" | "bad" {
  if (t === "info" || t === "violet") return "ok";
  return t;
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

function tone(s: "rolled-out" | "rolling" | "rolled-back"): "ok" | "warn" | "bad" {
  if (s === "rolled-back") return "bad";
  if (s === "rolling") return "warn";
  return "ok";
}
