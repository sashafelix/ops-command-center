/**
 * Generic HTTP connector.
 *
 * For internal APIs and arbitrary HTTP-reachable services that don't
 * deserve a dedicated connector. Configure URL + method + optional
 * headers + body + expected status, and `test()` sends the request,
 * verifies the status, and reports a snippet of the response.
 *
 * Field shape:
 *   url            (url, required)
 *   method         (string, "GET"|"POST"|"PUT"|"PATCH"|"DELETE", default "GET")
 *   headers        (string, optional)  JSON object: {"x-api-key": "env:FOO"}
 *   body           (string, optional)  request body for non-GET
 *   expect_status  (string, optional)  e.g. "200" or "200-299"; default 2xx
 *
 * Header values support the same env:NAME / vault://... refs as other
 * connectors via resolveSecret.
 */

import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

export const httpConnector: Connector = {
  id: "http",
  name: "Generic HTTP",
  category: "Custom",
  requiredFieldKeys: ["url"],
  implemented: true,
  defaultFields() {
    return [
      { k: "url", label: "URL", type: "url", value: "" },
      { k: "method", label: "Method", type: "string", value: "GET" },
      { k: "headers", label: "Headers (JSON)", type: "string", value: "" },
      { k: "body", label: "Body", type: "string", value: "" },
      { k: "expect_status", label: "Expected status", type: "string", value: "2xx" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const url = (fieldValue(c, "url") ?? "").trim();
    if (!url) return { ok: false, reason: "url is required" };
    if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "url must start with http(s)://" };

    const method = ((fieldValue(c, "method") ?? "GET").toUpperCase() || "GET").trim();
    if (!METHODS.has(method)) return { ok: false, reason: `unsupported method ${method}` };

    const headers = resolveHeaders(fieldValue(c, "headers"));
    if (!headers.ok) return { ok: false, reason: headers.reason };

    const noBody = method === "GET" || method === "HEAD";
    const init: RequestInit = {
      method,
      headers: headers.value,
      signal: AbortSignal.timeout(5_000),
    };
    if (!noBody) init.body = fieldValue(c, "body") ?? "";

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }

    if (!matchesExpected(res.status, fieldValue(c, "expect_status"))) {
      return {
        ok: false,
        reason: `HTTP ${res.status} doesn't match expected (${fieldValue(c, "expect_status") ?? "2xx"})`,
      };
    }

    // Snippet of body for the success detail (up to 80 chars, single-line)
    let snippet = "";
    try {
      const text = await res.text();
      snippet = text.replace(/\s+/g, " ").trim().slice(0, 80);
    } catch {
      /* response may not be readable as text — fine */
    }
    return {
      ok: true,
      detail: `${method} ${urlHost(url)} → ${res.status}${snippet ? ` · ${snippet}` : ""}`,
    };
  },
};

// =============================================================================

function resolveHeaders(
  raw: string | undefined,
): { ok: true; value: Record<string, string> } | { ok: false; reason: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: unknown) {
    return { ok: false, reason: `headers JSON parse: ${err instanceof Error ? err.message : "bad json"}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "headers must be a JSON object" };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") {
      return { ok: false, reason: `header ${k}: value must be a string` };
    }
    const resolved = resolveSecret(v);
    if (!resolved.ok) {
      return { ok: false, reason: `header ${k}: ${resolved.reason} (${resolved.detail})` };
    }
    out[k] = resolved.value;
  }
  return { ok: true, value: out };
}

function matchesExpected(status: number, expected: string | undefined): boolean {
  const spec = (expected ?? "2xx").trim().toLowerCase();
  if (spec === "any" || spec === "*") return true;
  if (spec === "2xx") return status >= 200 && status < 300;
  if (spec === "3xx") return status >= 300 && status < 400;
  if (spec === "4xx") return status >= 400 && status < 500;
  if (spec === "5xx") return status >= 500 && status < 600;
  // Single status code, e.g. "204" or "401"
  if (/^\d{3}$/.test(spec)) return Number(spec) === status;
  // Range "200-299"
  const range = /^(\d{3})-(\d{3})$/.exec(spec);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    return status >= lo && status <= hi;
  }
  return false;
}

function urlHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}
