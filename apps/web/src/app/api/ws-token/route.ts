import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";

/**
 * Mints a 60s HS256 JWT the browser uses to upgrade to apps/realtime.
 * Re-mint on reconnect; never persist.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("unauthorized", { status: 401 });
  const secret = process.env.REALTIME_JWT_SECRET ?? "";
  if (!secret) return new NextResponse("misconfigured", { status: 500 });

  const token = await new SignJWT({
    email: session.user.email ?? undefined,
    role: session.user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuer("ops-web")
    .setAudience("ops-realtime")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
}
