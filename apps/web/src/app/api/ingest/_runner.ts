/**
 * Shared runner for /api/ingest/* endpoints.
 *
 * Responsibilities:
 *   1. Verify the Bearer API token.
 *   2. Check the required scope.
 *   3. Validate the JSON body against a Zod schema.
 *   4. Run the handler.
 *   5. Translate TokenError + ZodError into HTTP responses.
 *
 * Handlers receive the parsed input and the authenticated token row; they
 * return the JSON payload to send back (status 200 by default) or a
 * { status, body } tuple.
 */

import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import {
  bearerFrom,
  hasScope,
  verifyApiToken,
  TokenError,
  type ApiTokenRow,
  type Scope,
} from "@/server/api-tokens";

type HandlerResult<O> = O | { status: number; body: unknown };

export function ingestHandler<I, O>(opts: {
  scope: Scope;
  input: ZodSchema<I>;
  handle: (input: I, ctx: { token: ApiTokenRow; req: Request }) => Promise<HandlerResult<O>>;
}) {
  return async function POST(req: Request) {
    try {
      const token = await verifyApiToken(bearerFrom(req));
      if (!hasScope(token.scopes, opts.scope)) {
        throw new TokenError("insufficient_scope");
      }
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return NextResponse.json({ error: "bad_json" }, { status: 400 });
      }
      const parsed = opts.input.parse(raw);
      const out = await opts.handle(parsed, { token, req });
      if (out && typeof out === "object" && "status" in out && "body" in out) {
        const tup = out as { status: number; body: O };
        return NextResponse.json(tup.body, { status: tup.status });
      }
      return NextResponse.json(out as O, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof TokenError) {
        const status = err.reason === "insufficient_scope" ? 403 : 401;
        return NextResponse.json({ error: err.reason }, { status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "invalid_body", issues: err.issues },
          { status: 400 },
        );
      }
      console.error("[ingest] handler failed", err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
