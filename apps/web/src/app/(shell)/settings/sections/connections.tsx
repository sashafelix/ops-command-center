"use client";

import { useState } from "react";
import { Plug, Loader2, Zap, Pencil, Check, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { StatusDot } from "@/components/status-dot";
import type { Connection, ConnectionField } from "@/server/mock/seed";
import { cn } from "@/lib/utils";

// Which connection ids have a real connector wired up. Used to enable/disable
// the Test button — keeps the UX honest about which sources can actually be
// reached vs. stay configurable-but-stubbed for now.
const TESTABLE = new Set(["anthropic", "github", "proxmox"]);

export function ConnectionsSection({ items }: { items: Connection[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [pending, setPending] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const test = trpc.settings.testConnection.useMutation({
    onSettled: () => {
      setPending(null);
      void utils.settings.overview.invalidate();
    },
    onSuccess: (r, vars) => {
      setLastResult((prev) => ({ ...prev, [vars.id]: r }));
    },
  });

  const save = trpc.settings.saveConnection.useMutation({
    onSuccess: () => {
      setEditingId(null);
      void utils.settings.overview.invalidate();
    },
  });

  async function onTest(id: string, name: string) {
    const ok = await requireFreshAuth(`Test connection to ${name}.`);
    if (!ok) return;
    setPending(id);
    test.mutate({ id });
  }

  const byCategory = items.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-13 font-semibold text-fg">Connections</h2>
      {Object.entries(byCategory).map(([category, conns]) => (
        <section key={category}>
          <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
            {category}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {conns.map((c) => {
              const result = lastResult[c.id];
              const isPending = pending === c.id;
              const canTest = TESTABLE.has(c.id);
              const isEditing = editingId === c.id;
              return (
                <article key={c.id} className="panel p-3 flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <Plug size={12} className="text-fg-faint" aria-hidden />
                    <span className="text-13 text-fg flex-1 truncate">{c.name}</span>
                    <StatusDot
                      tone={c.health === "ok" ? "ok" : c.health === "warn" ? "warn" : "bad"}
                      label={c.status}
                    />
                  </header>
                  <div className="text-11 text-fg-muted truncate">{c.detail}</div>
                  {result && (
                    <div className={cn("text-11", result.ok ? "text-ok" : "text-bad")}>
                      {result.ok ? "✓" : "✗"} {result.detail}
                    </div>
                  )}

                  {isEditing ? (
                    <FieldEditor
                      fields={c.fields}
                      busy={save.isPending}
                      error={save.error?.message ?? null}
                      onCancel={() => setEditingId(null)}
                      onSave={async (values) => {
                        const ok = await requireFreshAuth(`Update connection ${c.name}.`);
                        if (!ok) return;
                        save.mutate({ id: c.id, values });
                      }}
                    />
                  ) : (
                    <>
                      <FieldSummary fields={c.fields} />
                      <footer className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "chip",
                            c.health === "warn" && "warn",
                            c.health === "bad" && "bad",
                            c.health === "ok" && "ok",
                          )}
                        >
                          {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          disabled={c.fields.length === 0}
                          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={c.fields.length === 0 ? "No editable fields" : "Edit fields"}
                        >
                          <Pencil size={11} aria-hidden /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onTest(c.id, c.name)}
                          disabled={!canTest || isPending}
                          title={canTest ? "Run a reachability check" : "No connector wired up (stub-only)"}
                          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isPending ? (
                            <Loader2 size={11} className="animate-spin" aria-hidden />
                          ) : (
                            <Zap size={11} aria-hidden />
                          )}
                          Test
                        </button>
                        <span className="text-11 text-fg-faint ml-auto">last sync · {c.last_sync}</span>
                      </footer>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// One-liner per field, masking secret values. Replaces the read-only chip with
// useful info: "host=https://… · token=env:PROXMOX_TOKEN".
function FieldSummary({ fields }: { fields: ConnectionField[] }) {
  if (fields.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {fields.map((f) => (
        <li key={f.k} className="flex items-baseline gap-2 text-11">
          <span className="font-mono text-fg-faint w-20 shrink-0 truncate">{f.k}</span>
          <span className="font-mono text-fg-muted truncate">
            {f.value === "" ? <span className="text-fg-faint italic">unset</span> : maskValue(f)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function maskValue(f: ConnectionField): string {
  // env:NAME and vault://… are references, not secrets — show as-is so the
  // operator can spot a typo without re-entering the value.
  if (f.type === "secret" && !f.value.startsWith("env:") && !f.value.startsWith("vault://")) {
    return f.value.length <= 4 ? "•".repeat(f.value.length) : `${"•".repeat(Math.max(0, f.value.length - 4))}${f.value.slice(-4)}`;
  }
  return f.value;
}

function FieldEditor({
  fields,
  busy,
  error,
  onCancel,
  onSave,
}: {
  fields: ConnectionField[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (values: Array<{ k: string; value: string }>) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.k, f.value])),
  );
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function commit() {
    const values = fields.map((f) => ({ k: f.k, value: draft[f.k] ?? "" }));
    void onSave(values);
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      {fields.map((f) => (
        <FieldInput
          key={f.k}
          field={f}
          value={draft[f.k] ?? ""}
          revealed={revealed.has(f.k)}
          onToggleReveal={() =>
            setRevealed((prev) => {
              const next = new Set(prev);
              if (next.has(f.k)) next.delete(f.k);
              else next.add(f.k);
              return next;
            })
          }
          onChange={(v) => setDraft((prev) => ({ ...prev, [f.k]: v }))}
        />
      ))}
      <div className="flex items-center gap-2 justify-end mt-1">
        {error && <span className="text-11 text-bad mr-auto truncate">{error}</span>}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-7 px-2 text-11 text-fg-muted hover:text-fg disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={busy}
          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Check size={11} aria-hidden />}
          Save
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  revealed,
  onToggleReveal,
  onChange,
}: {
  field: ConnectionField;
  value: string;
  revealed: boolean;
  onToggleReveal: () => void;
  onChange: (v: string) => void;
}) {
  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 text-11 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="accent-info"
        />
        <span className="font-mono text-fg-muted w-20 shrink-0">{field.k}</span>
        <span className="text-fg-muted">{field.label}</span>
      </label>
    );
  }

  const isSecret = field.type === "secret";
  // env: / vault:// refs aren't secrets, so don't mask them — the operator
  // needs to read the name to fix typos. Real secret values get the toggle.
  const isReference = isSecret && (value.startsWith("env:") || value.startsWith("vault://"));
  const inputType = isSecret && !isReference && !revealed ? "password" : field.type === "url" ? "url" : "text";

  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-11 text-fg-muted w-20 shrink-0 truncate" title={field.label}>
        {field.k}
      </span>
      <div className="flex-1 relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderFor(field)}
          className="w-full h-8 panel2 bg-transparent px-2 font-mono text-11 text-fg outline-none focus:border-line2"
          spellCheck={false}
          autoComplete="off"
        />
        {isSecret && !isReference && value !== "" && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleReveal();
            }}
            aria-label={revealed ? "Hide value" : "Reveal value"}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-fg-faint hover:text-fg"
          >
            {revealed ? <EyeOff size={11} aria-hidden /> : <Eye size={11} aria-hidden />}
          </button>
        )}
      </div>
    </label>
  );
}

function placeholderFor(f: ConnectionField): string {
  if (f.type === "url") return "https://…";
  if (f.type === "secret") return "env:NAME or paste the secret";
  return "";
}
