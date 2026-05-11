/**
 * Liveness probe for the compose healthcheck. Intentionally cheap: no DB hit,
 * no auth. A 200 here means the Node process is up and the route layer is
 * serving requests — DB readiness is gated separately via the postgres
 * service's own healthcheck.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}
