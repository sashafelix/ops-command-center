import { resolveSecret } from "./secrets";
import { fieldValue, type Connector, type ConnectorTest } from "./types";
import type { Connection } from "@/server/mock/seed";

export const slackConnector: Connector = {
  id: "slack",
  name: "Slack",
  category: "Notifications",
  requiredFieldKeys: ["bot_token"],
  implemented: true,
  defaultFields() {
    return [
      {
        k: "bot_token",
        label: "Bot token",
        type: "secret",
        value: "env:SLACK_BOT_TOKEN",
      },
    ];
  },
  async test(c: Connection): Promise<ConnectorTest> {
    const tokRef = fieldValue(c, "bot_token");
    const tok = resolveSecret(tokRef);
    if (!tok.ok) return { ok: false, reason: `bot_token: ${tok.reason} (${tok.detail})` };

    try {
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tok.value}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} from slack.com/api/auth.test` };
      const body = (await res.json()) as { ok?: boolean; team?: string; user?: string; error?: string };
      if (!body.ok) return { ok: false, reason: body.error ?? "auth.test returned ok=false" };
      return {
        ok: true,
        detail: `auth ok · team ${body.team ?? "?"} · user ${body.user ?? "?"}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  },
};
