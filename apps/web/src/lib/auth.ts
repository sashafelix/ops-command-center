import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

type Provider = NextAuthConfig["providers"][number];
import type { JWT } from "next-auth/jwt";
import type { Role } from "@ops/shared";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
    };
  }
  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    sub?: string;
  }
}

// Side-effect: ensure module identity for the augmentation
export type _AugmentedJWT = JWT;

const DEFAULT_ROLE: Role = "viewer";
const VALID_ROLES: Role[] = ["viewer", "analyst", "sre", "admin"];

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Explicit prod-time escape hatch that re-enables the dev credentials
 * bypass on a NODE_ENV=production build. Intended for single-operator,
 * self-hosted deploys behind a VPN / Tailscale / local network only —
 * anyone who can reach /login becomes admin.
 *
 * The runtime banner + login-page hint make it obvious when this is on
 * so it can't quietly ship to a public deployment.
 */
const ALLOW_BYPASS = process.env.ALLOW_DEV_BYPASS === "1";
const BYPASS_ENABLED = IS_DEV || ALLOW_BYPASS;

if (ALLOW_BYPASS && !IS_DEV) {
  console.warn(
    "[auth] ALLOW_DEV_BYPASS=1 — credentials bypass is enabled on a production build. " +
      "Anyone reachable can sign in as any role. Disable before exposing publicly.",
  );
}

const providers: Provider[] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID ?? "",
    clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    authorization: {
      params: {
        prompt: "select_account",
      },
    },
  }),
];

if (BYPASS_ENABLED) {
  // Credentials bypass. Registered when either:
  //   - NODE_ENV=development (always), or
  //   - ALLOW_DEV_BYPASS=1 on a production build (explicit operator opt-in)
  // The authorize() callback re-checks the same gate to refuse stale-config
  // requests sent after the env var was cleared.
  providers.push(
    Credentials({
      id: "dev-bypass",
      name: "Dev bypass",
      credentials: {
        role: { label: "Role", type: "text" },
      },
      authorize(input) {
        const stillAllowed =
          process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_BYPASS === "1";
        if (!stillAllowed) return null;
        const raw = typeof input?.role === "string" ? input.role : "viewer";
        const role: Role = (VALID_ROLES as string[]).includes(raw)
          ? (raw as Role)
          : "viewer";
        return {
          id: `dev-${role}`,
          email: `${role}@dev.local`,
          name: `Dev ${role}`,
          role,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8h
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role ?? DEFAULT_ROLE;
      if (!token.role) token.role = DEFAULT_ROLE;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role | undefined) ?? DEFAULT_ROLE;
      }
      return session;
    },
  },
  trustHost: true,
});
