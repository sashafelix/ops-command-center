import "dotenv/config";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { WsClientMessage } from "@ops/shared";
import { verifyUpgradeToken } from "./auth";
import { TopicHub, type Subscriber } from "./topics";
import { nextNowPlayingTick } from "./mock-source";
import { startPgListener } from "./pg-listen";
import { startSyncTick } from "./sync-tick";
import { startWebhookTick } from "./webhook-tick";

const HOST = process.env.REALTIME_HOST ?? "127.0.0.1";
const PORT = Number(process.env.REALTIME_PORT ?? 4001);

const hub = new TopicHub();

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("t");
    const principal = await verifyUpgradeToken(token);
    if (!principal) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, principal);
    });
  } catch (err) {
    console.error("[realtime] upgrade failed", err);
    try {
      socket.destroy();
    } catch {
      /* noop */
    }
  }
});

wss.on("connection", (ws: WebSocket) => {
  const sub: Subscriber = {
    send: (data) => ws.send(data),
    cursorByTopic: new Map(),
  };

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "bad_json", message: "invalid JSON" }));
      return;
    }
    const result = WsClientMessage.safeParse(parsed);
    if (!result.success) {
      ws.send(JSON.stringify({ type: "error", code: "bad_message", message: result.error.message }));
      return;
    }
    const msg = result.data;
    switch (msg.type) {
      case "subscribe": {
        const { status, cursor } = hub.subscribe(msg.topic, sub, msg.cursor);
        ws.send(JSON.stringify({ type: "ack", topic: msg.topic, cursor, status }));
        return;
      }
      case "unsubscribe": {
        hub.unsubscribe(msg.topic, sub);
        return;
      }
      case "ping": {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
    }
  });

  ws.on("close", () => hub.removeEverywhere(sub));
  ws.on("error", () => hub.removeEverywhere(sub));
});

// 1Hz now-playing tick — runtime + cost only, per HANDOFF motion budget
setInterval(() => {
  hub.broadcast("now-playing", nextNowPlayingTick());
}, 1000);

server.listen(PORT, HOST, () => {
  console.log(`[realtime] ws://${HOST}:${PORT} ready`);
});

// Bridge Postgres NOTIFY → WS hub. Skips gracefully if DATABASE_URL is unset.
void startPgListener(hub).catch((err: unknown) => {
  console.error("[realtime] pg listener failed", err);
});

// Periodic connector sync (Proxmox → Infra, etc.). Skips if SYNC_SECRET unset.
startSyncTick();

// Webhook delivery worker — POSTs registered URLs when audit events match.
void startWebhookTick().catch((err: unknown) => {
  console.error("[realtime] webhook tick failed to start", err);
});
