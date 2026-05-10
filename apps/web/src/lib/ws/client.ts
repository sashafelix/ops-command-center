"use client";

import type { WsTopic } from "@ops/shared";

type Listener = (payload: unknown, cursor: string) => void;

type ServerEvent =
  | { type: "event"; topic: WsTopic; cursor: string; ts: string; payload: unknown }
  | { type: "ack"; topic: WsTopic; cursor: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong" };

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;

/**
 * Single multiplexed WS connection per browser tab. Subscribers are stored per
 * topic; all topics share the socket. Reconnects with exponential backoff and
 * resubscribes to all known topics. Phase 5: cursor resume on reconnect.
 *
 * Visibility gating: while document.visibilityState === 'hidden', the socket
 * stays open but we don't open a new one if it dropped — we wait for visibility.
 */
class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<WsTopic, Set<Listener>>();
  private subscribed = new Set<WsTopic>();
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
        // Resubscribe everything
        for (const topic of this.subscribed) {
          ws.send(JSON.stringify({ type: "subscribe", topic }));
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
      const set = this.listeners.get(msg.topic);
      if (!set) return;
      for (const fn of set) fn(msg.payload, msg.cursor);
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
        this.ws.send(JSON.stringify({ type: "subscribe", topic }));
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
}

let _client: WsClient | null = null;
export function getWsClient(): WsClient {
  if (!_client) _client = new WsClient();
  return _client;
}
