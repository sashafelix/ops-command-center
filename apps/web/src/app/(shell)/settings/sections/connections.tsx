"use client";

import { useState } from "react";
import { Plug, Loader2, Zap, Pencil, Check, Eye, EyeOff, Plus, Trash2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useReauthGate } from "@/components/reauth/reauth-gate";
import { DialogCloseButton } from "@/components/dialog-close-button";
import type { Connection, ConnectionField } from "@/server/mock/seed";
import { cn } from "@/lib/utils";

type StatusKind = NonNullable<Connection["status"]>;

export function ConnectionsSection({ items }: { items: Connection[] }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const [pending, setPending] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  const remove = trpc.settings.deleteConnection.useMutation({
    onSuccess: () => void utils.settings.overview.invalidate(),
  });

  async function onTest(id: string, name: string) {
    const ok = await requireFreshAuth(`Test connection to ${name}.`);
    if (!ok) return;
    setPending(id);
    test.mutate({ id });
  }

  async function onDelete(id: string, name: string) {
    const ok = await requireFreshAuth(`Delete connection ${name}. This cannot be undone.`);
    if (!ok) return;
    remove.mutate({ id });
  }

  const byCategory = items.reduce<Record<string, Connection[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-13 font-semibold text-fg">Connections</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-8 px-2 panel2 hover:border-line2 text-12 text-fg-muted hover:text-fg flex items-center gap-1.5"
        >
          <Plus size={12} aria-hidden /> New connection
        </button>
      </header>

      {Object.entries(byCategory).map(([category, conns]) => (
        <section key={category}>
          <div className="font-mono text-[10.5px] tracking-widest uppercase text-fg-faint px-1 mb-2">
            {category}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {conns.map((c) => {
              const result = lastResult[c.id];
              const isPending = pending === c.id;
              const canTest = c.has_connector === true;
              const isEditing = editingId === c.id;
              const status = (c.status ?? "unverified") as StatusKind;
              return (
                <article key={c.id} className="panel p-3 flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <Plug size={12} className="text-fg-faint" aria-hidden />
                    <span className="text-13 text-fg flex-1 truncate">{c.name}</span>
                    <StatusPill status={status} />
                  </header>
                  <div className="text-11 text-fg-muted truncate">{c.detail}</div>

                  {/* Last test history (when present) */}
                  {c.last_test_at && c.last_test_detail && (
                    <div
                      className={cn(
                        "text-11 font-mono truncate",
                        c.last_test_ok ? "text-fg-muted" : "text-bad",
                      )}
                      title={c.last_test_detail}
                    >
                      {c.last_test_ok ? "✓" : "✗"} {c.last_test_detail} ·{" "}
                      <span className="text-fg-faint">{relTime(c.last_test_at)}</span>
                    </div>
                  )}

                  {/* Fresh-this-tab result (overrides historical line when present) */}
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
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          disabled={c.fields.length === 0}
                          className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={c.fields.length === 0 ? "No editable fields" : "Edit fields"}
                        >
                          <Pencil size={11} aria-hidden /> Edit
                        </button>
                        {canTest ? (
                          <button
                            type="button"
                            onClick={() => void onTest(c.id, c.name)}
                            disabled={isPending}
                            className="h-7 px-2 panel2 hover:border-line2 text-11 text-fg-muted hover:text-fg flex items-center gap-1 disabled:opacity-40"
                          >
                            {isPending ? (
                              <Loader2 size={11} className="animate-spin" aria-hidden />
                            ) : (
                              <Zap size={11} aria-hidden />
                            )}
                            Test
                          </button>
                        ) : (
                          <span
                            className="h-7 px-2 text-11 text-fg-faint flex items-center gap-1"
                            title="No connector implementation exists yet — Test is unavailable. You can still configure the fields and delete the row."
                          >
                            <AlertCircle size={11} aria-hidden /> no connector
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void onDelete(c.id, c.name)}
                          aria-label={`Delete ${c.name}`}
                          title="Delete connection"
                          className="h-7 w-7 ml-auto flex items-center justify-center text-fg-faint hover:text-bad"
                        >
                          <Trash2 size={11} aria-hidden />
                        </button>
                      </footer>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {creating && <NewConnectionDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

// =============================================================================
// Status pill — derived state, honest naming
// =============================================================================

function StatusPill({ status }: { status: StatusKind }) {
  const tone: ToneSpec = TONE[status] ?? TONE.unverified!;
  return (
    <span className={cn("chip", tone.cls)} title={tone.title}>
      {tone.dot && <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", tone.dotCls)} />}
      {tone.label}
    </span>
  );
}

type ToneSpec = { label: string; cls: string; dot?: boolean; dotCls?: string; title: string };

const TONE: Record<string, ToneSpec> = {
  stub: {
    label: "stub",
    cls: "text-fg-faint",
    title: "No connector implementation. You can configure the fields, but reachability can't be verified yet.",
  },
  incomplete: {
    label: "incomplete",
    cls: "warn",
    title: "One or more required fields are empty.",
  },
  unverified: {
    label: "unverified",
    cls: "warn",
    title: "Fields look complete, but the last test result is missing or stale.",
  },
  connected: {
    label: "connected",
    cls: "ok",
    dot: true,
    dotCls: "bg-ok",
    title: "Last test passed within the freshness window.",
  },
  "needs-attention": {
    label: "needs attention",
    cls: "bad",
    dot: true,
    dotCls: "bg-bad",
    title: "Last test failed.",
  },
  disconnected: {
    label: "disconnected",
    cls: "warn",
    title: "Connection is not configured.",
  },
};

// =============================================================================
// Field display / edit
// =============================================================================

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
  if (f.type === "secret" && !f.value.startsWith("env:") && !f.value.startsWith("vault://")) {
    return f.value.length <= 4
      ? "•".repeat(f.value.length)
      : `${"•".repeat(Math.max(0, f.value.length - 4))}${f.value.slice(-4)}`;
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

// =============================================================================
// New connection dialog
// =============================================================================

function NewConnectionDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { requireFreshAuth } = useReauthGate();
  const types = trpc.settings.listConnectorTypes.useQuery();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState("");
  const [name, setName] = useState("");

  const create = trpc.settings.createConnection.useMutation({
    onSuccess: () => {
      void utils.settings.overview.invalidate();
      onClose();
    },
  });

  async function submit() {
    if (!typeId) return;
    const ok = await requireFreshAuth(`Create a new ${typeId} connection.`);
    if (!ok) return;
    create.mutate({
      type_id: typeId,
      ...(instanceId ? { instance_id: instanceId } : {}),
      ...(name ? { name } : {}),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New connection"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative panel w-full max-w-md p-5 animate-appear">
        <DialogCloseButton onClick={onClose} />
        <header className="mb-3 pr-8">
          <h3 className="text-13 font-semibold text-fg">New connection</h3>
          <p className="text-11 text-fg-muted mt-1">
            Pick a connector type. Only types with an implementation are listed; stubs aren&apos;t useful to add yet.
          </p>
        </header>

        <label className="block text-11 text-fg-muted mb-1">Connector type</label>
        <div className="flex flex-col gap-1 mb-3">
          {types.data?.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex items-center gap-2 panel2 px-2 h-8 cursor-pointer text-12",
                typeId === t.id && "border-line2 text-fg",
              )}
            >
              <input
                type="radio"
                name="type"
                checked={typeId === t.id}
                onChange={() => setTypeId(t.id)}
                className="accent-info"
              />
              <span className="font-mono text-fg-muted">{t.id}</span>
              <span className="text-fg-muted">·</span>
              <span className="text-fg-muted">{t.name}</span>
              <span className="ml-auto chip">{t.category}</span>
            </label>
          ))}
          {types.isLoading && <span className="text-11 text-fg-faint">loading…</span>}
        </div>

        <label className="block text-11 text-fg-muted mb-1">
          Instance id <span className="text-fg-faint">(optional)</span>
        </label>
        <input
          type="text"
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          placeholder={typeId ?? "anthropic-staging, github-readonly, …"}
          pattern="[a-z0-9_-]+"
          className="w-full h-8 panel2 bg-transparent px-2 font-mono text-11 text-fg outline-none mb-3"
        />

        <label className="block text-11 text-fg-muted mb-1">
          Display name <span className="text-fg-faint">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={types.data?.find((t) => t.id === typeId)?.name ?? "—"}
          className="w-full h-8 panel2 bg-transparent px-2 text-12 text-fg outline-none mb-3"
        />

        <footer className="flex items-center gap-2 mt-4">
          {create.error && (
            <span className="text-11 text-bad mr-auto truncate" title={create.error.message}>
              {create.error.message}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 panel2 text-12 text-fg-muted hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!typeId || create.isPending}
            className="h-8 px-3 panel2 hover:border-line2 text-12 text-fg disabled:opacity-50 flex items-center gap-1.5"
          >
            {create.isPending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Plus size={12} aria-hidden />}
            Create
          </button>
        </footer>
      </div>
    </div>
  );
}

// =============================================================================
// utils
// =============================================================================

function relTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
