/**
 * LLM clients for eval execution.
 *
 * Two real provider implementations (Anthropic + OpenAI) plus a
 * deterministic mock for when no credentials are configured. The
 * worker calls `callModel({provider, model, prompt})` and gets back
 * either a real response or a mocked one — same shape either way.
 *
 * Credentials come from env (EVAL_ANTHROPIC_KEY / EVAL_OPENAI_KEY),
 * not from the connections table, so the realtime worker doesn't need
 * to know about the web app's secret-resolution layer. Operators
 * configure these once in .env alongside their other API keys.
 *
 * Cost estimates are coarse (per-1M-token rates) — good enough for
 * dashboard display, not to be relied on for billing.
 */

import { createHash } from "node:crypto";

export type LlmProvider = "anthropic" | "openai" | "mock";

export type ModelCall = {
  text: string;
  latency_ms: number;
  cost_usd: number;
  provider: LlmProvider;
  error?: string;
};

const ANTHROPIC_KEY = process.env.EVAL_ANTHROPIC_KEY ?? "";
const OPENAI_KEY = process.env.EVAL_OPENAI_KEY ?? "";
const REQUEST_TIMEOUT_MS = 30_000;

/** Coarse $/1M-token rates. */
const RATES = {
  "claude-3-5-sonnet": { in: 3, out: 15 },
  "sonnet-4.5": { in: 3, out: 15 },
  "claude-3-haiku": { in: 0.25, out: 1.25 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
} as const;

export function pickProvider(modelName: string): LlmProvider {
  if (modelName.startsWith("sonnet") || modelName.startsWith("claude")) {
    return ANTHROPIC_KEY ? "anthropic" : "mock";
  }
  if (modelName.startsWith("gpt")) {
    return OPENAI_KEY ? "openai" : "mock";
  }
  // Unknown model — default to anthropic if a key's available, else mock.
  return ANTHROPIC_KEY ? "anthropic" : "mock";
}

export async function callModel(opts: { model: string; prompt: string }): Promise<ModelCall> {
  const provider = pickProvider(opts.model);
  if (provider === "anthropic") return callAnthropic(opts);
  if (provider === "openai") return callOpenAI(opts);
  return callMock(opts);
}

// =============================================================================
// Anthropic
// =============================================================================

async function callAnthropic(opts: { model: string; prompt: string }): Promise<ModelCall> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: mapToAnthropicModel(opts.model),
        max_tokens: 256,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const latency_ms = Date.now() - t0;
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        text: "",
        latency_ms,
        cost_usd: 0,
        provider: "anthropic",
        error: `HTTP ${res.status}: ${errBody.slice(0, 160)}`,
      };
    }
    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (body.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const cost_usd = costFor(opts.model, body.usage?.input_tokens ?? 0, body.usage?.output_tokens ?? 0);
    return { text, latency_ms, cost_usd, provider: "anthropic" };
  } catch (err: unknown) {
    return {
      text: "",
      latency_ms: Date.now() - t0,
      cost_usd: 0,
      provider: "anthropic",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function mapToAnthropicModel(name: string): string {
  // The seed uses "sonnet-4.5" as a friendly label; map to a real API id.
  if (name === "sonnet-4.5" || name === "sonnet-5-rc") return "claude-3-5-sonnet-latest";
  if (name.startsWith("claude-")) return name;
  return "claude-3-5-sonnet-latest";
}

// =============================================================================
// OpenAI
// =============================================================================

async function callOpenAI(opts: { model: string; prompt: string }): Promise<ModelCall> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model.startsWith("gpt") ? opts.model : "gpt-4o-mini",
        max_tokens: 256,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const latency_ms = Date.now() - t0;
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        text: "",
        latency_ms,
        cost_usd: 0,
        provider: "openai",
        error: `HTTP ${res.status}: ${errBody.slice(0, 160)}`,
      };
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const cost_usd = costFor(opts.model, body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0);
    return { text, latency_ms, cost_usd, provider: "openai" };
  } catch (err: unknown) {
    return {
      text: "",
      latency_ms: Date.now() - t0,
      cost_usd: 0,
      provider: "openai",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// =============================================================================
// Mock provider — deterministic given (prompt, minute) so re-running the
// same suite produces stable results within a minute. Used when no API keys
// are configured.
// =============================================================================

async function callMock(opts: { model: string; prompt: string }): Promise<ModelCall> {
  // Tiny delay so the worker visibly progresses through cases in the UI
  // rather than completing instantly.
  await delay(80 + Math.floor(Math.random() * 120));
  const minute = Math.floor(Date.now() / 60_000);
  const seedHex = createHash("sha256").update(`${opts.prompt}:${minute}`).digest("hex");
  // Pull a few short tokens from the seed to compose an answer that
  // sometimes contains keywords the expected_pattern regex looks for,
  // and sometimes doesn't.
  const tokens = [
    "401",
    "reject",
    "deny",
    "verify",
    "signature",
    "rotate",
    "invalidate",
    "400",
    "invalid",
    "round",
    "ceil",
    "refund",
    "empty",
    "results",
    "5",
    "k",
    "tenant",
    "workspace",
  ];
  // Pick 4 deterministic tokens
  const picks: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = parseInt(seedHex.slice(i * 2, i * 2 + 2), 16) % tokens.length;
    picks.push(tokens[idx]!);
  }
  const text = `Mock response: ${picks.join(", ")} — derived from prompt hash.`;
  return {
    text,
    latency_ms: 80 + Math.floor(Math.random() * 120),
    cost_usd: 0,
    provider: "mock",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function costFor(model: string, inputTokens: number, outputTokens: number): number {
  const rate = (RATES as Record<string, { in: number; out: number }>)[model] ?? RATES["sonnet-4.5"];
  return Number(((inputTokens * rate.in + outputTokens * rate.out) / 1_000_000).toFixed(6));
}

/** Reported on boot so an operator can see at a glance which providers are live. */
export function providerStatus(): { anthropic: boolean; openai: boolean } {
  return { anthropic: Boolean(ANTHROPIC_KEY), openai: Boolean(OPENAI_KEY) };
}
