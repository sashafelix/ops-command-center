import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that don't go through the session-cookie auth. /api/ingest/*
// authenticates with Bearer API tokens at the handler level; /api/sync/*
// authenticates with the shared SYNC_SECRET header (called by apps/realtime).
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/ingest", "/api/sync"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

// Match everything except static assets / images / favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
