/**
 * Loads the canonical mock dataset into Postgres. Idempotent: truncates the
 * tables it owns then re-inserts inside one transaction.
 *
 * Run via `pnpm -F @ops/web db:seed` after `pnpm db:migrate`.
 *
 * The mock data still lives at `src/server/mock/seed.ts` so we only have one
 * source of truth for the demo dataset; this script reshapes it for the
 * relational store and rebuilds the audit chain deterministically with
 * node:crypto SHA-256 (bit-identical to the browser-side verifier).
 */

import { config as dotenvConfig } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { seed as MOCK } from "@/server/mock/seed";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename);
dotenvConfig({ path: path.resolve(__dirname_, "../../.env.local") });
dotenvConfig();

function canonicalJsonSync(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonSync).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonSync(obj[k])}`).join(",")}}`;
  }
  throw new Error(`canonicalJsonSync: unsupported type ${typeof value}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[seed] DATABASE_URL not set");
    process.exit(1);
  }
  const conn = postgres(url, { max: 1 });
  const db = drizzle(conn, { schema });

  await db.transaction(async (tx) => {
    console.log("[seed] truncating + reseeding…");

    // Truncate everything in dependency-safe order
    await tx.execute(sql`TRUNCATE TABLE
      audit_events, evidence_events, investigations, threat_buckets,
      tool_calls, approvals, sessions,
      service_load, slos, incidents, deploys, services, regions,
      status_signals, status_incidents, status_page_meta,
      signing_keys, agent_versions,
      eval_regressions, eval_suites, eval_ab,
      budget_breaches, budgets, budget_meta,
      ad_hoc_reports, scheduled_reports, compliance_bundles,
      webhooks, tokens, members, connections, prefs, workspace,
      runtime, reauth_markers, kv_meta, policies, notifications
      RESTART IDENTITY`);

    // ----- Sessions -----
    const allSessionRows = [
      ...MOCK.active.map((s) => ({ ...s, _phase: "active" as const })),
      ...MOCK.watching.map((s) => ({ ...s, _phase: "watching" as const })),
    ];
    const seenIds = new Set<string>();
    for (const s of allSessionRows) {
      if (seenIds.has(s.id)) continue;
      seenIds.add(s.id);
      await tx.insert(schema.sessions).values({
        id: s.id,
        agent_version: s.agent,
        model: s.model,
        repo: s.repo,
        goal: s.goal,
        operator: "mara@ops",
        started_at: new Date(Date.now() - s.runtime_s * 1000),
        runtime_s: s.runtime_s,
        cost_usd: s.cost_usd,
        tokens_in: 0,
        tokens_out: 0,
        tool_calls: s.tools,
        trust_score: s.trust_score,
        status: s.status,
        outcome: "in-progress" as const,
        extra: { step: s.step, spark: s.spark, pinned: s.pinned, hot: s.hot, phase: s._phase },
      });
    }
    for (const d of MOCK.done) {
      if (seenIds.has(d.id)) continue;
      seenIds.add(d.id);
      await tx.insert(schema.sessions).values({
        id: d.id,
        agent_version: d.agent,
        model: "sonnet-4.5",
        repo: "—",
        goal: d.goal,
        operator: "mara@ops",
        started_at: new Date(Date.now() - 60 * 60 * 1000),
        runtime_s: 0,
        cost_usd: d.cost_usd,
        tokens_in: 0,
        tokens_out: 0,
        tool_calls: d.tools,
        trust_score: d.trust_score,
        status: d.status,
        outcome: d.status === "bad" ? "aborted" : "success",
        extra: { duration: d.duration, when: d.when },
      });
    }

    // ----- Approvals -----
    for (const a of MOCK.approvals.queue) {
      // Ensure the parent session exists (some approvals reference sessions
      // not in the active/watching/done lists).
      if (!seenIds.has(a.session_id)) {
        seenIds.add(a.session_id);
        await tx.insert(schema.sessions).values({
          id: a.session_id,
          agent_version: a.agent,
          model: "sonnet-4.5",
          repo: "—",
          goal: a.goal,
          operator: "mara@ops",
          started_at: new Date(),
          runtime_s: 0,
          cost_usd: 0,
          tokens_in: 0,
          tokens_out: 0,
          tool_calls: 0,
          trust_score: 1,
          status: "ok",
          outcome: "in-progress",
          extra: {},
        });
      }
      await tx.insert(schema.approvals).values({
        id: a.id,
        session_id: a.session_id,
        severity: a.severity,
        policy_id: a.policy,
        command: a.command,
        justification: a.justification,
        blast_radius: a.blast_radius,
        requested_at: new Date(a.requested_at),
        auto_deny_at: new Date(a.auto_deny_at),
        extra: { agent: a.agent, goal: a.goal, action: a.action, requires: a.requires, of: a.of },
      });
    }

    // ----- Policies -----
    for (const p of MOCK.approvals.policies) {
      await tx.insert(schema.policies).values({
        id: p.id,
        name: p.name,
        surface: p.surface,
        mode: p.mode,
        enabled: p.enabled,
        owner_user_id: "mara@ops",
      });
    }

    // ----- Infra -----
    for (const r of MOCK.infra.regions) {
      await tx.insert(schema.regions).values({
        id: r.id,
        name: r.name,
        status: r.status,
        nodes: r.nodes,
        az: r.az,
        cost_per_hour: r.cost_per_hour,
        traffic_pct: r.traffic_pct,
      });
    }
    for (const s of MOCK.infra.services) {
      await tx.insert(schema.services).values({
        id: s.id,
        name: s.name,
        stack: s.stack,
        region: s.region,
        replicas: s.replicas,
        cpu_pct: s.cpu_pct,
        mem_pct: s.mem_pct,
        rps: s.rps,
        error_pct: s.error_pct,
        p95_ms: s.p95_ms,
        status: s.status,
        reason: s.reason ?? null,
        version: s.version,
      });
    }
    for (const l of MOCK.infra.load) {
      for (let i = 0; i < l.values.length; i++) {
        await tx.insert(schema.service_load).values({
          service_id: l.id,
          minute: i,
          cpu_pct: l.values[i] ?? 0,
        });
      }
    }
    for (const i of MOCK.infra.incidents) {
      await tx.insert(schema.incidents).values({
        id: i.id,
        severity: i.severity,
        service_id: i.service_id,
        title: i.title,
        started_at: new Date(Date.now() - 14 * 60 * 1000),
        status: i.status,
        assignee: i.assignee,
      });
    }
    for (const d of MOCK.infra.deploys) {
      await tx.insert(schema.deploys).values({
        id: d.id,
        target_kind: "service",
        service_or_agent_id: d.service,
        version: d.version,
        from_version: null,
        channel: "stable",
        who: d.who,
        when: new Date(Date.now() - 18 * 60 * 1000),
        status: d.status === "warn" ? "rolling" : "rolled-out",
        rollback_candidate: d.rollback_candidate,
      });
    }
    for (const s of MOCK.infra.slos) {
      await tx.insert(schema.slos).values({
        id: s.id,
        service_id: null,
        name: s.name,
        target: s.target,
        actual: s.actual,
        burn_rate: s.burn_rate,
        state: s.state,
      });
    }

    // ----- Status page -----
    await tx.insert(schema.status_page_meta).values({
      id: "default",
      url: MOCK.statusPage.url,
      published: MOCK.statusPage.published,
    });
    for (const s of MOCK.statusPage.publicSignals) {
      await tx.insert(schema.status_signals).values({
        id: s.id,
        name: s.name,
        state: s.state,
        uptime: s.uptime,
        last_incident: s.last_incident,
        is_public: true,
        uptime90: s.uptime90,
      });
    }
    for (const s of MOCK.statusPage.privateSignals) {
      await tx.insert(schema.status_signals).values({
        id: s.id,
        name: s.name,
        state: s.state,
        is_public: false,
        note: s.note,
      });
    }
    for (const i of MOCK.statusPage.incidents) {
      await tx.insert(schema.status_incidents).values({
        id: i.id,
        title: i.title,
        state: i.state,
        started_at: i.started_at,
        updates: i.updates,
        is_public: i.public,
      });
    }

    // ----- Agents -----
    for (const a of MOCK.agents.list) {
      await tx.insert(schema.agent_versions).values({
        id: a.id,
        name: a.id,
        version: a.version,
        channel: a.channel,
        status: a.status,
        model: a.model,
        owner: a.owner,
        trust_score: a.trust,
        runs_24h: a.runs_24h,
        cost_24h: a.cost_24h,
        p95_s: a.p95_s,
        tools: a.tools,
        rate_per_min: a.rate_per_min,
        budget: a.budget,
        signing_key_fp: "",
        signed: a.signed,
        drift: a.drift,
        spark: a.spark,
      });
    }
    for (const d of MOCK.agents.deploys) {
      await tx.insert(schema.deploys).values({
        id: d.id,
        target_kind: "agent",
        service_or_agent_id: d.agent,
        version: d.to,
        from_version: d.from,
        channel: d.channel,
        who: d.who,
        when: new Date(Date.now() - 4 * 60 * 60 * 1000),
        eval_delta: d.eval_delta,
        cost_delta: d.cost_delta,
        rollback_candidate: false,
        status: d.status,
      });
    }
    for (const k of MOCK.agents.keys) {
      await tx.insert(schema.signing_keys).values({
        fingerprint: k.fingerprint,
        agent: k.agent,
        algo: k.algo,
        sigs_24h: k.sigs_24h,
        last_used: new Date(Date.now() - 12 * 1000),
      });
    }

    // ----- Evals -----
    for (const s of MOCK.evals.suites) {
      await tx.insert(schema.eval_suites).values({
        id: s.id,
        cases: s.cases,
        pass_rate: s.pass_rate,
        baseline_pass_rate: s.baseline,
        delta: s.delta,
        flake_rate: s.flake_rate,
        model: s.model,
        status: s.status,
        trend: s.trend,
        last_ran_at: new Date(Date.now() - 12 * 60 * 1000),
      });
    }
    for (const r of MOCK.evals.regressions) {
      await tx.insert(schema.eval_regressions).values({
        id: r.id,
        suite_id: r.suite,
        case: r.case,
        model: r.model,
        first_fail: new Date(Date.now() - 12 * 60 * 1000),
        occurrences: r.occurrences,
        owner: r.owner,
        commit: r.commit,
      });
    }
    await tx.insert(schema.eval_ab).values({
      id: "default",
      name: MOCK.evals.ab.name,
      a_label: MOCK.evals.ab.a.label,
      a_wins: MOCK.evals.ab.a.wins,
      a_score: MOCK.evals.ab.a.score,
      b_label: MOCK.evals.ab.b.label,
      b_wins: MOCK.evals.ab.b.wins,
      b_score: MOCK.evals.ab.b.score,
      trials: MOCK.evals.ab.trials,
      significance: MOCK.evals.ab.significance,
    });

    // ----- Budgets -----
    await tx.insert(schema.budget_meta).values({
      id: "default",
      spend_24h: MOCK.budgets.kpi.spend_24h,
      cap_day: MOCK.budgets.kpi.cap_day,
      spend_mtd: MOCK.budgets.kpi.spend_mtd,
      cap_month: MOCK.budgets.kpi.cap_month,
      forecast: MOCK.budgets.kpi.forecast,
      breaches_30d: MOCK.budgets.kpi.breaches_30d,
      mtd_daily: MOCK.budgets.mtd_daily,
      cap_line: MOCK.budgets.cap_line,
    });
    for (const t of MOCK.budgets.teams) {
      await tx.insert(schema.budgets).values({
        id: t.id,
        team_id: t.id,
        label: t.label,
        daily_cap: t.cap,
        cap_mtd: t.cap_mtd,
        spend_24h: t.spend_24h,
        mtd_actual: t.mtd,
        forecast_eom: 0,
        agents: t.agents,
        runs: t.runs,
        trend: t.trend,
        spark: t.spark,
        status: t.status,
      });
    }
    for (const b of MOCK.budgets.breaches) {
      await tx.insert(schema.budget_breaches).values({
        id: b.id,
        team: b.team,
        cap: b.cap,
        amount: b.amount,
        when: new Date(),
        action: b.action,
        resolved: b.resolved,
      });
    }

    // ----- Trust -----
    for (const t of MOCK.trust.threats) {
      for (let h = 0; h < t.values.length; h++) {
        await tx.insert(schema.threat_buckets).values({
          category: t.category,
          hour: h,
          value: t.values[h] ?? 0,
        });
      }
    }
    for (const i of MOCK.trust.investigations) {
      await tx.insert(schema.investigations).values({
        id: i.id,
        severity: i.severity,
        title: i.title,
        session_id: seenIds.has(i.session_id) ? i.session_id : null,
        opened_at: new Date(Date.now() - 7 * 60 * 1000),
        evidence_status: i.evidence_status,
        status: i.status,
      });
    }
    for (const e of MOCK.trust.evidence) {
      // Some evidence rows reference sessions not present; skip those
      if (!seenIds.has(e.session_id)) continue;
      await tx.insert(schema.evidence_events).values({
        id: e.id,
        session_id: e.session_id,
        kind: e.kind,
        hash: e.hash,
        signed: e.signed,
        signed_by: e.signed_by ?? null,
        signed_at: new Date(),
      });
    }

    // ----- Reports -----
    for (const r of MOCK.reports.scheduled) {
      await tx.insert(schema.scheduled_reports).values({
        id: r.id,
        name: r.name,
        cadence: r.cadence,
        next_run: r.next_run,
        recipients: r.recipients,
        format: r.format,
        last_run: r.last_run,
      });
    }
    for (const r of MOCK.reports.ad_hoc) {
      await tx.insert(schema.ad_hoc_reports).values({
        id: r.id,
        name: r.name,
        by: r.by,
        generated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        size: r.size,
      });
    }
    for (const b of MOCK.reports.bundles) {
      await tx.insert(schema.compliance_bundles).values({
        id: b.id,
        name: b.name,
        framework: b.framework,
        status: b.status,
        last_built: b.last_built,
        range: b.range,
        content_hash: b.content_hash,
      });
    }

    // ----- Settings -----
    await tx.insert(schema.workspace).values({
      id: "default",
      workspace_name: MOCK.settings.general.workspace_name,
      org_id: MOCK.settings.general.org_id,
      created_at: MOCK.settings.general.created_at,
      tier: MOCK.settings.general.tier,
      version: MOCK.settings.about.version,
      build_id: MOCK.settings.about.build_id,
      commit: MOCK.settings.about.commit,
      built_at: new Date(MOCK.settings.about.built_at),
    });
    for (const c of MOCK.settings.connections) {
      await tx.insert(schema.connections).values({
        id: c.id,
        name: c.name,
        category: c.category,
        status: c.status,
        detail: c.detail,
        fields: c.fields,
        last_sync: c.last_sync,
        health: c.health,
      });
    }
    for (const m of MOCK.settings.members) {
      await tx.insert(schema.members).values({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        mfa: m.mfa,
        last_seen: new Date(),
      });
    }
    for (const t of MOCK.settings.tokens) {
      await tx.insert(schema.tokens).values({
        id: t.id,
        name: t.name,
        scope: t.scope,
        created_at: new Date("2026-03-02"),
        last_used: new Date(Date.now() - 14 * 1000),
        expires_at: new Date("2026-08-02"),
      });
    }
    for (const w of MOCK.settings.webhooks) {
      await tx.insert(schema.webhooks).values({
        id: w.id,
        url: w.url,
        events: w.events,
        status: w.status,
        delivery_stats: w.delivery_stats,
      });
    }
    await tx.insert(schema.prefs).values({
      id: "default",
      retention: MOCK.settings.prefs.retention,
      timezone: MOCK.settings.prefs.timezone,
      density: MOCK.settings.prefs.density,
      auto_refresh: MOCK.settings.prefs.auto_refresh,
      ambient_audio: MOCK.settings.prefs.ambient_audio,
      theme: MOCK.settings.prefs.theme,
      language: MOCK.settings.prefs.language,
      experimental: MOCK.settings.prefs.experimental,
    });

    // ----- Runtime -----
    await tx.insert(schema.runtime).values({ id: "default", paused: false });

    // ----- KV meta (the per-surface KPI blobs) -----
    type KvSeed = { key: string; data: unknown };
    const kvSeeds: KvSeed[] = [
      { key: "live.kpi", data: MOCK.kpi },
      { key: "live.now_playing", data: MOCK.nowPlaying },
      {
        key: "live.board",
        data: {
          counts: {
            active: MOCK.active.length,
            watching: MOCK.watching.length,
            done1h: MOCK.done.length,
          },
          active: MOCK.active,
          watching: MOCK.watching,
          done: MOCK.done,
        },
      },
      { key: "sessions.table", data: MOCK.sessionsTable },
      { key: "sessions.receipt", data: MOCK.receipt },
      { key: "approvals.counts", data: MOCK.approvals.counts },
      { key: "approvals.recent", data: MOCK.approvals.recent },
      { key: "infra.kpi", data: MOCK.infra.kpi },
      { key: "trust.kpi", data: MOCK.trust.kpi },
      { key: "agents.kpi", data: MOCK.agents.kpi },
      { key: "evals.kpi", data: MOCK.evals.kpi },
      { key: "budgets.top_runs", data: MOCK.budgets.top_runs },
    ];
    for (const k of kvSeeds) {
      await tx
        .insert(schema.kv_meta)
        .values({ key: k.key, data: k.data as Record<string, unknown> });
    }

    // ----- Audit chain (rebuilt deterministically) -----
    const actors = ["mara@ops", "devon@ops", "iris@ops", "kai@ops", "claude-code", "release-bot"];
    const roles = ["admin", "sre", "agent"] as const;
    const actions = [
      "approval.decide", "agent.rollback", "evals.run", "session.start", "session.end",
      "policy.update", "token.rotate", "member.invite", "deploy.execute", "incident.ack",
    ];
    const targets = [
      "approval/apr_8821", "deploy/dep_4421", "agent/claude-code", "session/sess_8c1a",
      "policy/p_destr", "token/tok_ci", "member/u_lin", "incident/inc_71",
    ];
    const baseTs = Date.now() - 25 * 60 * 60 * 1000;
    const N = 1200;
    let prevHash = "";
    for (let i = 0; i < N; i++) {
      const tsMs = baseTs + Math.floor((i / N) * 25 * 60 * 60 * 1000);
      const body = {
        id: `evt_${(100000 + i).toString(36)}`,
        ts: new Date(tsMs).toISOString(),
        actor: actors[i % actors.length]!,
        role: roles[i % roles.length]!,
        action: actions[i % actions.length]!,
        target: targets[i % targets.length]!,
        ip: `10.0.${(i / 256) | 0}.${i % 256}`,
        ua: i % 2 === 0 ? "ops-web/1.0 (chrome)" : "ops-cli/0.42",
      };
      const hash = createHash("sha256").update(prevHash + canonicalJsonSync(body)).digest("hex");
      await tx.insert(schema.audit_events).values({
        id: body.id,
        ts: new Date(body.ts),
        actor: body.actor,
        role: body.role,
        action: body.action,
        target: body.target,
        ip: body.ip,
        ua: body.ua,
        hash,
        prev_hash: prevHash,
        anchored_at: i % 60 === 0 ? new Date(body.ts) : null,
      });
      prevHash = hash;
    }
  });

  console.log("[seed] done");
  await conn.end();
}

main().catch((err: unknown) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
