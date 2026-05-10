import type { NowPlayingTick } from "@ops/shared";

/**
 * Mock now-playing tick source. In production this hooks into the agent runtime;
 * here it advances runtime by 1s and cost by ~$0.001 every interval, mirroring the
 * mock's behavior. Replace with a real source when the backend lands.
 */

let runtime = 252;
let cost = 0.83;
const SESSION_ID = "sess_8c1a";

export function nextNowPlayingTick(): NowPlayingTick {
  runtime += 1;
  cost += 0.0007 + Math.random() * 0.001;
  return {
    session_id: SESSION_ID,
    runtime_s: runtime,
    cost_usd: Math.round(cost * 1000) / 1000,
  };
}
