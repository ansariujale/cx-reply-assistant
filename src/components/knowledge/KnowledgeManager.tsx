"use client";

import clsx from "clsx";
import { BookOpen, Pencil, Plus, Quote, Tag, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { KB_CATEGORIES, KB_CATEGORY_LABELS, type Brand, type KbCategory, type KbEntry } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/toast";
import { Badge, BrandChip, Button, Collapsible, ConfirmButton, EmptyState, ErrorNote, Eyebrow, FormLabel, Input, Select, TextArea, Tile } from "@/components/ui";

interface Props {
  brands: Brand[];
  initialEntries: Record<string, KbEntry[]>;
}

interface FormState {
  category: KbCategory;
  title: string;
  content: string;
  tags: string;
}

const emptyForm = (): FormState => ({ category: "returns", title: "", content: "", tags: "" });
const toForm = (e: KbEntry): FormState => ({ category: e.category, title: e.title, content: e.content, tags: e.tags.join(", ") });

export function KnowledgeManager({ brands, initialEntries }: Props) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [entries, setEntries] = useState<Record<string, KbEntry[]>>(initialEntries);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KbCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const brand = brands.find((b) => b.id === brandId);
  const list = entries[brandId] ?? [];
  const visible = filter ? list.filter((e) => e.category === filter) : list;

  async function reload(id: string) {
    const fresh = await api<KbEntry[]>(`/api/brands/${id}/kb`);
    setEntries((prev) => ({ ...prev, [id]: fresh }));
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.push({ tone: "error", title: "Could not save", description: message });
    } finally {
      setBusy(false);
    }
  }

  const create = (form: FormState) =>
    withBusy(async () => {
      const created = await api<KbEntry>(`/api/brands/${brandId}/kb`, { method: "POST", json: form });
      setCreating(false);
      await reload(brandId);
      toast.push({ tone: "success", title: "Entry added", description: `"${created.title}" is live for ${brand?.name} on the next generation.` });
    });

  const update = (id: string, form: FormState) =>
    withBusy(async () => {
      await api<KbEntry>(`/api/kb/${id}`, { method: "PUT", json: form });
      setEditingId(null);
      await reload(brandId);
      toast.push({ tone: "success", title: "Entry updated" });
    });

  const remove = (entry: KbEntry) =>
    withBusy(async () => {
      await api(`/api/kb/${entry.id}`, { method: "DELETE" });
      await reload(brandId);
      toast.push({ tone: "info", title: "Entry deleted", description: `The assistant can no longer see "${entry.title}".` });
    });

  if (!brand) return <p className="text-sm text-stone-500">No brands configured.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div role="tablist" aria-label="Brand" className="relative inline-flex flex-wrap gap-1 rounded-full bg-stone-200/60 p-1">
          {brands.map((b) => {
            const active = b.id === brandId;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setBrandId(b.id);
                  setCreating(false);
                  setEditingId(null);
                  setFilter(null);
                  setError(null);
                }}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300 ease-out-expo",
                  active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.accentColor }} />
                {b.name}
                <span className="tabular text-xs text-stone-400">{(entries[b.id] ?? []).length}</span>
              </button>
            );
          })}
        </div>
        <Button variant={creating ? "secondary" : "accent"} onClick={() => setCreating((v) => !v)} disabled={busy}>
          <span className={clsx("transition-transform duration-300 ease-out-expo", creating && "rotate-45")}>
            <Plus className="h-4 w-4" aria-hidden />
          </span>
          {creating ? "Cancel" : "Add entry"}
        </Button>
      </div>

      <ErrorNote message={error} />

      <Collapsible open={creating}>
        <div className="pb-1">
          {creating && (
            <EntryForm
              key={`new-${brandId}`}
              title={`New entry for ${brand.name}`}
              initial={emptyForm()}
              busy={busy}
              onCancel={() => setCreating(false)}
              onSubmit={create}
            />
          )}
        </div>
      </Collapsible>

      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Tile className="col-span-2 flex flex-col justify-between p-5 md:col-span-3 lg:col-span-2 lg:row-span-2">
          <div>
            <Eyebrow>Brand</Eyebrow>
            <div className="mt-3">
              <BrandChip name={brand.name} color={brand.accentColor} size="md" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">{brand.description}</p>
          </div>
          <div className="mt-6 rounded-2xl bg-stone-50 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              <Quote className="h-3 w-3" aria-hidden /> Tone used in prompts
            </p>
            <p className="mt-2 text-sm italic leading-relaxed text-stone-600">{brand.tone}</p>
          </div>
        </Tile>

        {KB_CATEGORIES.map((cat) => {
          const count = list.filter((e) => e.category === cat).length;
          const active = filter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(active ? null : cat)}
              aria-pressed={active}
              className={clsx(
                "tile tile-hover flex flex-col justify-between p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:col-span-1",
                active && "ring-2 ring-indigo-500",
                cat === "general" && "col-span-2 md:col-span-3 lg:col-span-4",
              )}
            >
              <span className="eyebrow">{KB_CATEGORY_LABELS[cat]}</span>
              <span className="mt-6 flex items-end justify-between">
                <span className={clsx("display tabular text-4xl font-semibold leading-none", count === 0 ? "text-stone-300" : "text-stone-900")}>{count}</span>
                <span className="text-[11px] text-stone-400">{active ? "showing" : count === 0 ? "missing" : "entries"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filter ? `No ${KB_CATEGORY_LABELS[filter].toLowerCase()} entry for ${brand.name}` : `No knowledge for ${brand.name} yet`}
          body="Without an entry the assistant will say it needs to check with the team rather than guess."
          action={
            <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add entry
            </Button>
          }
        />
      ) : (
        <ul className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((entry) => (
            <li key={entry.id} className="min-w-0">
              {editingId === entry.id ? (
                <EntryForm
                  title={`Edit ${entry.title}`}
                  initial={toForm(entry)}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(form) => update(entry.id, form)}
                />
              ) : (
                <Tile className="group flex h-full flex-col p-5 transition-shadow duration-300 hover:shadow-tile-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge tone="neutral">{KB_CATEGORY_LABELS[entry.category]}</Badge>
                      <h3 className="display mt-3 text-lg font-semibold leading-snug text-stone-900">{entry.title}</h3>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(entry.id)} disabled={busy}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                      </Button>
                      <ConfirmButton label="Delete" confirmLabel="Confirm delete" icon={Trash2} onConfirm={() => remove(entry)} disabled={busy} />
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{entry.content}</p>
                  {entry.tags.length > 0 && (
                    <p className="mt-4 flex flex-wrap items-center gap-1.5">
                      <Tag className="h-3 w-3 text-stone-400" aria-hidden />
                      {entry.tags.map((t) => (
                        <span key={t} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                          {t}
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-stone-400" suppressHydrationWarning>
                    <span>Updated {formatDateTime(entry.updatedAt)}</span>
                    <span className="h-1 w-1 rounded-full bg-stone-300" />
                    <span className="font-mono">{entry.id}</span>
                  </p>
                </Tile>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryForm({
  title,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: FormState;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Tile className="animate-pop border-indigo-200 p-5 ring-4 ring-indigo-500/10">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="display text-base font-semibold text-stone-900">{title}</h3>
          <button type="button" onClick={onCancel} className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700" aria-label="Cancel">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <FormLabel htmlFor="kb-category">Category</FormLabel>
            <Select id="kb-category" className="w-full" value={form.category} onChange={(e) => set("category", e.target.value as KbCategory)}>
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {KB_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FormLabel htmlFor="kb-title">Title</FormLabel>
            <Input id="kb-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="For example: Refund policy" required />
          </div>
        </div>
        <div>
          <FormLabel htmlFor="kb-content">Policy text, exactly what the assistant may rely on</FormLabel>
          <TextArea
            id="kb-content"
            rows={5}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Include windows, fees and exceptions. The assistant cannot promise anything that is not written here."
            required
          />
        </div>
        <div>
          <FormLabel htmlFor="kb-tags">Tags, comma separated, used for retrieval</FormLabel>
          <Input id="kb-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="refund, money back, 7 days" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={busy}>
            Save entry
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Tile>
  );
}
