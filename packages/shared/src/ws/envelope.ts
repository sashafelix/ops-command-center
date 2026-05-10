import { z } from "zod";

/**
 * WS topic registry. Single multiplexed connection; clients subscribe per topic.
 * Phase 5 hardens reconnect/cursor-resume semantics.
 */
export const WsTopic = z.enum([
  "now-playing",
  "sessions",
  "evidence",
  "notifications",
]);
export type WsTopic = z.infer<typeof WsTopic>;

// Client → server
export const WsClientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), topic: WsTopic, cursor: z.string().optional() }),
  z.object({ type: z.literal("unsubscribe"), topic: WsTopic }),
  z.object({ type: z.literal("ping") }),
]);
export type WsClientMessage = z.infer<typeof WsClientMessage>;

// Server → client
export const WsServerMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    topic: WsTopic,
    cursor: z.string(),
    ts: z.string(),
    payload: z.unknown(),
  }),
  z.object({ type: z.literal("ack"), topic: WsTopic, cursor: z.string() }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("pong") }),
]);
export type WsServerMessage = z.infer<typeof WsServerMessage>;

/** Now-playing tick payload — the single thing that updates every second. */
export const NowPlayingTick = z.object({
  session_id: z.string(),
  runtime_s: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
});
export type NowPlayingTick = z.infer<typeof NowPlayingTick>;
