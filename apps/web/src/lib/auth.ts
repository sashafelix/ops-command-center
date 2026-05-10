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

if (IS_DEV) {
  // Dev-only bypass — never registered outside development. Lets a local
  // operator sign in as any role for RBAC poking without standing up an
  // OIDC client. Triple-gated: NODE_ENV check at module init, NODE_ENV
  // check inside authorize(), and the dev login form only renders in dev.
  providers.push(
    Credentials({
      id: "dev-bypass",
      name: "Dev bypass",
      credentials: {
        role: { label: "Role", type: "text" },
      },
      authorize(input) {
        if (process.env.NODE_ENV !== "development") return null;
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
