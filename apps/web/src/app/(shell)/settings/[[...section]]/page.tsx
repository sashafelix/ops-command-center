import { redirect } from "next/navigation";
import { trpcServer } from "@/lib/trpc/server";
import { SettingsShell } from "../settings-shell";

export const metadata = { title: "Settings · Ops Command Center" };

const SECTIONS = new Set([
  "general",
  "connections",
  "webhooks",
  "tokens",
  "members",
  "notifications",
  "prefs",
  "audit",
  "about",
]);

export default async function SettingsPage({ params }: { params: { section?: string[] } }) {
  const section = params.section?.[0] ?? "general";
  if (!SECTIONS.has(section)) redirect("/settings/general");
  const trpc = await trpcServer();
  const initial = await trpc.settings.overview();
  return <SettingsShell section={section} initial={initial} />;
}
