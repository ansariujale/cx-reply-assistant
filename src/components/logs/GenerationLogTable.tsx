"use client";

import clsx from "clsx";
import { ArrowUpRight, ChevronDown, Clock, Filter, RefreshCw, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { AiGeneration, GenerationStatus } from "@/lib/domain/types";
import { formatDateTime, percent } from "@/lib/format";
import { Badge, Button, Collapsible, EmptyState, Select, Stat, Tile } from "@/components/ui";

export interface ConversationMeta {
  customerName: string;
  brandName: string;
  brandColor: string;
  subject: string;
}

interface Props {
  initial: AiGeneration[];
  meta: Record<string, ConversationMeta>;
  brands: Array<{ id: string; name: string }>;
}

const STATUS_TONE: Record<GenerationStatus, "info" | "success" | "danger" | "neutral"> = {
  draft: "info",
  approved: "success",
  discarded: "danger",
  superseded: "neutral",
};

export function GenerationLogTable({ initial, meta, brands }: Props) {
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<"all" | GenerationStatus>("all");
  const [brand, setBrand] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = rows.filter((g) => (status === "all" || g.status === status) && (brand === "all" || g.brandId === brand));
  const approved = rows.filter((g) => g.status === "approved").length;
  const critical = rows.filter((g) => g.flags.some((f) => f.severity === "critical")).length;
  const avgLatency = rows.length ? Math.round(rows.reduce((s, g) => s + g.latencyMs, 0) / rows.length) : 0;

  async function refresh() {
    setLoading(true);
    try {
      setRows(await api<AiGeneration[]>("/api/generations?limit=200"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile className="p-5">
          <Stat label="Generations" value={rows.length} icon={ScrollText} tone="accent" />
        </Tile>
        <Tile className="p-5">
          <Stat label="Approved" value={approved} icon={ShieldCheck} tone="success" hint={`${percent(approved, rows.length)} of all drafts`} />
        </Tile>
        <Tile className="p-5">
          <Stat label="Critical flags" value={critical} icon={ShieldAlert} tone={critical ? "danger" : "neutral"} hint="Drafts held back for judgement" />
        </Tile>
        <Tile className="p-5">
          <Stat label="Avg latency" value={<span>{avgLatency}<span className="ml-1 text-2xl text-stone-400">ms</span></span>} icon={Clock} />
        </Tile>
      </div>

      <div className="flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: "200ms" }}>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filter
        </span>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="discarded">Discarded</option>
          <option value="superseded">Superseded</option>
        </Select>
        <Select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filter by brand">
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <span className="tabular text-xs text-stone-400">
          {filtered.length} of {rows.length}
        </span>
        <Button variant="secondary" size="sm" className="group ml-auto" onClick={refresh} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 ease-out-expo group-hover:rotate-180" aria-hidden /> Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No generations yet" body="Generate an AI reply in any conversation and it will appear here with its full context." />
      ) : (
        <Tile className="animate-fade-up overflow-hidden" style={{ animationDelay: "260ms" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline bg-stone-50/60 text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Brand and customer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Retrieval</th>
                  <th className="px-4 py-3 font-semibold">Confidence</th>
                  <th className="px-4 py-3 font-semibold">Flags</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((g) => {
                  const m = meta[g.conversationId];
                  const expanded = open === g.id;
                  const criticalCount = g.flags.filter((f) => f.severity === "critical").length;
                  const warnings = g.flags.filter((f) => f.severity === "warning").length;
                  return (
                    <RowPair key={g.id}>
                      <tr
                        className={clsx("cursor-pointer transition-colors duration-200 hover:bg-stone-50", expanded && "bg-stone-50")}
                        onClick={() => setOpen(expanded ? null : g.id)}
                      >
                        <td className="tabular whitespace-nowrap px-4 py-3 text-xs text-stone-500" suppressHydrationWarning>
                          {formatDateTime(g.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: m?.brandColor }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m?.brandColor ?? "#a8a29e" }} />
                            {m?.brandName ?? g.brandId}
                          </div>
                          <div className="text-sm text-stone-800">{m?.customerName ?? g.conversationId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={g.retrievalStatus === "found" ? "success" : g.retrievalStatus === "weak" ? "warning" : "danger"}>
                            {g.retrievalStatus}, {g.retrievedContext.length}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={g.assessment.confidence === "high" ? "success" : g.assessment.confidence === "medium" ? "warning" : "danger"}>
                            {g.assessment.confidence}
                            {!g.assessment.grounded && ", ungrounded"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {criticalCount > 0 && <span className="mr-2 font-semibold text-rose-600">{criticalCount} critical</span>}
                          {warnings > 0 && <span className="mr-2 text-amber-700">{warnings} warning{warnings === 1 ? "" : "s"}</span>}
                          {g.flags.length === 0 && <span className="text-emerald-600">none</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          <div className="font-mono text-[11px]">{g.model}</div>
                          <div className="tabular text-stone-400">
                            {g.latencyMs} ms{g.promptTokens != null ? `, ${g.promptTokens}/${g.completionTokens ?? 0} tok` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-400">
                          <ChevronDown className={clsx("h-4 w-4 transition-transform duration-300 ease-out-expo", expanded && "rotate-180")} aria-hidden />
                        </td>
                      </tr>
                      <tr className={clsx(!expanded && "border-0")}>
                        <td colSpan={8} className="p-0">
                          <Collapsible open={expanded}>
                            <div className="border-t border-hairline bg-stone-50/60 px-5 py-5">
                              <Detail g={g} meta={m} />
                            </div>
                          </Collapsible>
                        </td>
                      </tr>
                    </RowPair>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tile>
      )}
    </div>
  );
}

function RowPair({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className={clsx("mt-2 whitespace-pre-wrap rounded-2xl border border-hairline bg-white p-3.5 text-xs leading-relaxed text-stone-700", mono && "font-mono text-[11px]")}>
        {children}
      </div>
    </div>
  );
}

function Detail({ g, meta }: { g: AiGeneration; meta?: ConversationMeta }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Customer message">{g.customerMessage}</Field>
        <Field label={`Retrieved context (${g.retrievalStatus})`}>
          {g.retrievedContext.length === 0 ? (
            <span className="text-stone-400">No knowledge matched. Query: {g.retrievalQuery}</span>
          ) : (
            <ul className="space-y-3">
              {g.retrievedContext.map((c) => (
                <li key={c.entryId}>
                  <p className="font-medium text-stone-800">
                    {c.title} <span className="text-stone-400">({c.category}, score {c.score})</span>
                  </p>
                  <p className="mt-0.5 text-stone-600">{c.content}</p>
                  <p className="mt-1 font-mono text-[10px] text-stone-400">
                    {c.entryId}, matched {c.matchedTerms.join(", ") || "none"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Guardrail flags">
          {g.flags.length === 0 ? (
            <span className="text-emerald-700">None</span>
          ) : (
            <ul className="space-y-1.5">
              {g.flags.map((f, i) => (
                <li key={i}>
                  <span
                    className={clsx(
                      "mr-1.5 font-semibold",
                      f.severity === "critical" ? "text-rose-700" : f.severity === "warning" ? "text-amber-700" : "text-sky-700",
                    )}
                  >
                    [{f.severity}] {f.code}
                  </span>
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
      <div className="space-y-4">
        <Field label="AI generated response">{g.aiResponse}</Field>
        <Field label="Agent edited response">{g.agentEditedResponse ?? <span className="text-stone-400">Not edited</span>}</Field>
        <Field label="Final response sent">
          {g.finalResponse ?? <span className="text-stone-400">{g.status === "draft" ? "Pending approval" : "Not sent"}</span>}
        </Field>
        <Field label="Assessment and metadata" mono>
          {[
            `confidence: ${g.assessment.confidence}`,
            `grounded: ${g.assessment.grounded}`,
            `needs_human_review: ${g.assessment.needsHumanReview}`,
            `used_entry_ids: ${g.assessment.usedEntryIds.join(", ") || "-"}`,
            `missing_information: ${g.assessment.missingInformation.join("; ") || "-"}`,
            `rationale: ${g.assessment.rationale || "-"}`,
            `agent_instruction: ${g.agentInstruction ?? "-"}`,
            `provider/model: ${g.provider} / ${g.model}`,
            `tokens: ${g.promptTokens ?? "-"} in, ${g.completionTokens ?? "-"} out, ${g.latencyMs} ms`,
            `created: ${g.createdAt}`,
            `resolved: ${g.resolvedAt ?? "-"}`,
            `conversation: ${g.conversationId}${meta ? ` (${meta.subject})` : ""}`,
          ].join("\n")}
        </Field>
        <Link
          href={`/conversations/${g.conversationId}`}
          className="group inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
        >
          Open conversation
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
