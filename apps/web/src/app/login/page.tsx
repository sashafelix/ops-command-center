import { signIn } from "@/lib/auth";

export const metadata = {
  title: "Sign in · Ops Command Center",
};

// Sign-in form posts a server action; do not prerender.
export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const callbackUrl =
    searchParams.from && searchParams.from.startsWith("/") ? searchParams.from : "/live";
  const isDev = process.env.NODE_ENV === "development";
  const allowBypass = process.env.ALLOW_DEV_BYPASS === "1";
  const bypassEnabled = isDev || allowBypass;
  const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="panel w-full max-w-sm p-8">
        <div className="mb-6">
          <h1 className="text-13 font-semibold tracking-tight">Ops Command Center</h1>
          <p className="text-12 text-fg-muted mt-1">Sign in to continue.</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            disabled={!googleConfigured}
            className="w-full h-9 inline-flex items-center justify-center gap-2 rounded panel2 hover:border-line2 text-12 text-fg disabled:opacity-50"
          >
            Continue with Google
          </button>
        </form>
        {!googleConfigured && (
          <p className="text-11 text-fg-faint mt-2">
            Google OIDC not configured. Set <span className="font-mono">AUTH_GOOGLE_ID</span> and{" "}
            <span className="font-mono">AUTH_GOOGLE_SECRET</span> in{" "}
            <span className="font-mono">apps/web/.env.local</span>.
          </p>
        )}

        {bypassEnabled && (
          <>
            <div className="flex items-center gap-3 my-5" aria-hidden>
              <span className="flex-1 h-px bg-line/10" />
              <span className="font-mono text-[10.5px] tracking-widest text-fg-faint uppercase">
                {isDev ? "dev only" : "bypass active"}
              </span>
              <span className="flex-1 h-px bg-line/10" />
            </div>

            <form
              action={async (formData) => {
                "use server";
                const role = String(formData.get("role") ?? "viewer");
                await signIn("dev-bypass", { role, redirectTo: callbackUrl });
              }}
              className="flex flex-col gap-2"
            >
              <label className="text-11 text-fg-muted flex items-center justify-between gap-2">
                <span>Sign in as</span>
                <select
                  name="role"
                  defaultValue="admin"
                  className="h-7 px-2 panel2 text-12 text-fg bg-transparent outline-none"
                >
                  <option value="viewer">viewer · read-only</option>
                  <option value="analyst">analyst · can run evals</option>
                  <option value="sre">sre · can decide approvals + rollback</option>
                  <option value="admin">admin · workspace + kill switch</option>
                </select>
              </label>
              <button
                type="submit"
                className="w-full h-9 inline-flex items-center justify-center gap-2 rounded panel2 hover:border-line2 text-12 text-fg"
              >
                Continue without OIDC
              </button>
              <p className="text-11 text-fg-faint">
                {isDev
                  ? "Dev bypass — only available when NODE_ENV=development."
                  : "ALLOW_DEV_BYPASS=1 — anyone reachable can sign in. Single-user / VPN-only deploys only."}
              </p>
            </form>
          </>
        )}

        <p className="text-11 text-fg-faint mt-6">
          New OIDC accounts default to viewer. An admin can upgrade your role.
        </p>
      </div>
    </main>
  );
}
