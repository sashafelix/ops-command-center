import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

const DEFAULT_API = "https://api.github.com";

export const githubConnector: Connector = {
  id: "github",
  name: "GitHub",
  category: "Repos",
  requiredFieldKeys: ["token"],
  defaultFields() {
    return [
      { k: "host", label: "Host", type: "url", value: "https://github.com" },
      { k: "token", label: "Personal token", type: "secret", value: "env:GITHUB_TOKEN" },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const host = fieldValue(c, "host") ?? "https://github.com";
    const api = host === "https://github.com" ? DEFAULT_API : `${host}/api/v3`;
    const tokenRef = fieldValue(c, "token");
    const tok = resolveSecret(tokenRef);
    if (!tok.ok) return { ok: false, reason: `token: ${tok.reason} (${tok.detail})` };

    try {
      const res = await fetch(`${api}/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tok.value}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "ops-command-center",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from ${api}/user` };
      const u = (await res.json()) as { login?: string };
      return { ok: true, detail: `auth ok · ${u.login ?? "unknown"}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};

/**
 * Fetch the latest commit on a branch + open PR state. Used by the session
 * detail enrichment in Phase 8 wave 2. Public for now so the route handler
 * can call it directly.
 */
export async function getBranchHead(
  c: Connection,
  owner: string,
  repo: string,
  branch: string,
): Promise<
  | { ok: true; sha: string; commitUrl: string; openPRs: number }
  | { ok: false; reason: string }
> {
  const host = fieldValue(c, "host") ?? "https://github.com";
  const api = host === "https://github.com" ? DEFAULT_API : `${host}/api/v3`;
  const tokenRef = fieldValue(c, "token");
  const tok = resolveSecret(tokenRef);
  if (!tok.ok) return { ok: false, reason: `token: ${tok.reason}` };

  const headers = {
    Authorization: `Bearer ${tok.value}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "ops-command-center",
  };
  try {
    const [branchRes, prsRes] = await Promise.all([
      fetch(`${api}/repos/${owner}/${repo}/branches/${branch}`, { headers, signal: AbortSignal.timeout(5_000) }),
      fetch(`${api}/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branch}`, {
        headers,
        signal: AbortSignal.timeout(5_000),
      }),
    ]);
    if (!branchRes.ok) return { ok: false, reason: `branch HTTP ${branchRes.status}` };
    const branchBody = (await branchRes.json()) as {
      commit?: { sha: string; html_url?: string };
    };
    const prsBody = prsRes.ok ? ((await prsRes.json()) as unknown[]) : [];
    const sha = branchBody.commit?.sha ?? "";
    const commitUrl = branchBody.commit?.html_url ?? "";
    return { ok: true, sha, commitUrl, openPRs: prsBody.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}
