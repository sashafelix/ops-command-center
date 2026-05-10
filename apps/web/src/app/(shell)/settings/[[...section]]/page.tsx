import { redirect } from "next/navigation";
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

export default function SettingsPage({ params }: { params: { section?: string[] } }) {
  const section = params.section?.[0] ?? "general";
  if (!SECTIONS.has(section)) redirect("/settings/general");
  return <SettingsShell section={section} />;
}
