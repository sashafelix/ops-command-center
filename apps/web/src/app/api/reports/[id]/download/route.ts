/**
 * Authenticated download of a generated ad-hoc report.
 *
 * Session cookie auth — same Auth.js gate the dashboard uses. No token
 * auth here because reports are operator-facing artifacts, not agent
 * ingress. Returns the row's stored content with the right Content-Type
 * + Content-Disposition for a friendly filename.
 */

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";

export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  JSONL: "application/x-ndjson",
  JSON: "application/json",
  CSV: "text/csv",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("unauthorized", { status: 401 });
  }

  const [row] = await db
    .select()
    .from(schema.ad_hoc_reports)
    .where(eq(schema.ad_hoc_reports.id, params.id));
  if (!row) {
    return new Response("not found", { status: 404 });
  }
  if (!row.content) {
    return new Response("report has no content yet", { status: 409 });
  }

  const contentType = CONTENT_TYPE[row.format] ?? "application/octet-stream";
  const filename = `${slugify(row.name)}-${row.id}.${row.format.toLowerCase()}`;

  return new Response(row.content, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "report";
}
