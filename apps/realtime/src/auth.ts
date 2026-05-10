import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.REALTIME_JWT_SECRET ?? "");

export type WsPrincipal = {
  sub: string;
  email?: string | undefined;
  role: string;
};

/**
 * Verifies the short-lived HS256 JWT minted by the web app and passed to the WS
 * service either as the `?t=` query string or in the `Sec-WebSocket-Protocol`
 * subprotocol slot.
 */
export async function verifyUpgradeToken(token: string | null | undefined): Promise<WsPrincipal | null> {
  if (!token) return null;
  if ((process.env.REALTIME_JWT_SECRET ?? "").length === 0) {
    console.warn("[realtime] REALTIME_JWT_SECRET not set — rejecting all upgrades");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      audience: "ops-realtime",
      issuer: "ops-web",
    });
    return {
      sub: String(payload.sub ?? ""),
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : "viewer",
    };
  } catch {
    return null;
  }
}
