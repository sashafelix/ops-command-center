import { Placeholder } from "@/components/placeholder";

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
  const known = SECTIONS.has(section);
  return (
    <Placeholder
      title={`Settings · ${section}`}
      blurb={
        known
          ? "Sub-sections per HANDOFF §6 land in Phase 4."
          : "Unknown section. Returning to placeholder."
      }
      empty="Settings ship in Phase 4."
    />
  );
}
