"use client";

import type { WsTopic } from "@ops/shared";

type Listener = (payload: unknown, cursor: string) => void;
type GapListener = (topic: WsTopic) => void;

type ServerEvent =
  | { type: "event"; topic: WsTopic; cursor: string; ts: string; payload: unknown }
  | { type: "ack"; topic: WsTopic; cursor: string; status?: "ok" | "fresh" | "gap" }
  | { type: "error"; code: string; message: string }
  | { type: "pong" };

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;

/**
 * Single multiplexed WS connection per browser tab.
 *
 * - Subscribers are stored per topic; all topics share the socket.
 * - Per-topic cursor: every event the server sends carries a monotonic cursor
 *   the client remembers. On reconnect we send the last cursor with the
 *   subscribe message so the server replays anything we missed (Phase 5
 *   cursor resume per HANDOFF §4 realtime strategy).
 * - If the server signals `gap` (cursor older than its ring buffer), we fire
 *   the registered `onGap` listener so the consuming surface can refetch a
 *   fresh snapshot via tRPC.
 * - Reconnects with exponential backoff (500ms → 15s).
 * - Visibility gating: while the tab is hidden, do not schedule a fresh
 *   reconnect — wait for visibilitychange before retrying.
 */
class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<WsTopic, Set<Listener>>();
  private subscribed = new Set<WsTopic>();
  private cursors = new Map<WsTopic, string>();
  private gapListeners = new Set<GapListener>();
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private connecting = false;

  async ensureOpen(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;
    this.connecting = true;
    try {
      const res = await fetch("/api/ws-token", { credentials: "include" });
      if (!res.ok) throw new Error(`ws-token: ${res.status}`);
      const { token } = (await res.json()) as { token: string };
      const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:4001";
      const ws = new WebSocket(`${url}/?t=${encodeURIComponent(token)}`);
      this.ws = ws;
      ws.addEventListener("open", () => {
        this.reconnectAttempt = 0;
        // Resubscribe with last-known cursor per topic so the server replays gaps.
        for (const topic of this.subscribed) {
          const cursor = this.cursors.get(topic);
          ws.send(JSON.stringify({ type: "subscribe", topic, ...(cursor ? { cursor } : {}) }));
        }
      });
      ws.addEventListener("message", (e) => this.handle(String(e.data)));
      ws.addEventListener("close", () => this.scheduleReconnect());
      ws.addEventListener("error", () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      });
    } catch {
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onVisible);
          void this.ensureOpen();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return;
    }
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureOpen();
    }, delay);
  }

  private handle(raw: string): void {
    let msg: ServerEvent;
    try {
      msg = JSON.parse(raw) as ServerEvent;
    } catch {
      return;
    }
    if (msg.type === "event") {
      this.cursors.set(msg.topic, msg.cursor);
      const set = this.listeners.get(msg.topic);
      if (!set) return;
      for (const fn of set) fn(msg.payload, msg.cursor);
      return;
    }
    if (msg.type === "ack") {
      // Update the cursor so a subsequent reconnect resumes from the right place.
      if (msg.cursor) this.cursors.set(msg.topic, msg.cursor);
      if (msg.status === "gap") {
        for (const fn of this.gapListeners) fn(msg.topic);
      }
      return;
    }
  }

  subscribe(topic: WsTopic, listener: Listener): () => void {
    let set = this.listeners.get(topic);
    if (!set) {
      set = new Set();
      this.listeners.set(topic, set);
    }
    set.add(listener);

    const wasNewTopic = !this.subscribed.has(topic);
    this.subscribed.add(topic);

    void this.ensureOpen().then(() => {
      if (wasNewTopic && this.ws?.readyState === WebSocket.OPEN) {
        const cursor = this.cursors.get(topic);
        this.ws.send(JSON.stringify({ type: "subscribe", topic, ...(cursor ? { cursor } : {}) }));
      }
    });

    return () => {
      const s = this.listeners.get(topic);
      s?.delete(listener);
      if (s && s.size === 0) {
        this.listeners.delete(topic);
        this.subscribed.delete(topic);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "unsubscribe", topic }));
        }
      }
    };
  }

  /**
   * Register a callback fired when the server reports a `gap` on resume — the
   * client missed too much to replay. Consumers should refetch a fresh
   * snapshot via tRPC.
   */
  onGap(listener: GapListener): () => void {
    this.gapListeners.add(listener);
    return () => this.gapListeners.delete(listener);
  }
}

let _client: WsClient | null = null;
export function getWsClient(): WsClient {
  if (!_client) _client = new WsClient();
  return _client;
}
