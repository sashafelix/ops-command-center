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
  const callbackUrl = searchParams.from && searchParams.from.startsWith("/") ? searchParams.from : "/live";
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
            className="w-full h-9 inline-flex items-center justify-center gap-2 rounded panel2 hover:border-line2 text-12 text-fg"
          >
            Continue with Google
          </button>
        </form>
        <p className="text-11 text-fg-faint mt-6">
          New accounts default to viewer. An admin can upgrade your role.
        </p>
      </div>
    </main>
  );
}
