"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  History,
  Info,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AiGeneration, Brand, Confidence, FlagSeverity, GuardrailFlag } from "@/lib/domain/types";
import { KB_CATEGORY_LABELS, type KbCategory } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Collapsible, Disclosure, EmptyState, Eyebrow, Input, PulseDots, Skeleton, TextArea, Tile, TileHeader } from "@/components/ui";
import type { Busy } from "./ConversationWorkspace";

interface Props {
  brand: Brand;
  draft: AiGeneration | null;
  history: AiGeneration[];
  draftText: string;
  onDraftTextChange: (text: string) => void;
  onApprove: () => void;
  onDiscard: () => void;
  onRegenerate: (instruction: string) => void;
  busy: Busy;
}

const SEVERITY_ORDER: Record<FlagSeverity, number> = { critical: 0, warning: 1, info: 2 };

const CONFIDENCE_TONE: Record<Confidence, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

function overall(flags: GuardrailFlag[]) {
  if (flags.some((f) => f.severity === "critical")) {
    return { tone: "danger" as const, label: "Do not send as is", hint: "Critical guardrail flags need your judgement first.", icon: ShieldAlert };
  }
  if (flags.some((f) => f.severity === "warning")) {
    return { tone: "warning" as const, label: "Review before sending", hint: "Check the flagged points against the policy.", icon: AlertTriangle };
  }
  return { tone: "success" as const, label: "Grounded draft", hint: "No guardrail flags. Still yours to approve.", icon: ShieldCheck };
}

export function AiDraftPanel({ brand, draft, history, draftText, onDraftTextChange, onApprove, onDiscard, onRegenerate, busy }: Props) {
  const [instruction, setInstruction] = useState("");
  const generating = busy === "generate";
  const edited = draft ? draftText.trim() !== draft.aiResponse.trim() : false;
  const status = draft ? overall(draft.flags) : null;

  return (
    <div className="space-y-4 xl:sticky xl:top-24">
      <Tile className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-glow">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="display text-base font-semibold leading-tight text-stone-900">AI draft</p>
              <p className="text-[11px] text-stone-400">Reviewed by you before anything is sent</p>
            </div>
          </div>
          {status && !generating && (
            <Badge tone={status.tone} icon={status.icon}>
              {status.label}
            </Badge>
          )}
        </div>

        {generating ? (
          <GeneratingState brandName={brand.name} />
        ) : !draft ? (
          <EmptyState
            icon={Sparkles}
            title="No draft yet"
            body={
              <>
                Click <span className="font-medium text-stone-700">Generate AI reply</span> in the composer. The assistant will identify the brand,
                retrieve only {brand.name}&apos;s policies, draft a reply and run guardrail checks.
              </>
            }
          />
        ) : (
          <div key={draft.id} className="animate-pop space-y-5">
            {status && <p className="text-xs text-stone-500">{status.hint}</p>}

            <FlagList flags={draft.flags} usedCount={draft.assessment.usedEntryIds.length} />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Eyebrow>Reply to customer</Eyebrow>
                <Collapsible open={edited}>
                  <Badge tone="info">edited by you</Badge>
                </Collapsible>
              </div>
              <TextArea
                rows={8}
                value={draftText}
                onChange={(e) => onDraftTextChange(e.target.value)}
                disabled={busy !== null}
                aria-label="AI draft reply"
                className="text-[13.5px]"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-400">
                <span className="tabular">{draftText.length} characters</span>
                <Collapsible open={edited}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 transition-colors hover:text-stone-700"
                    onClick={() => onDraftTextChange(draft.aiResponse)}
                  >
                    <Undo2 className="h-3 w-3" aria-hidden /> Reset to AI version
                  </button>
                </Collapsible>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="lg" onClick={onApprove} loading={busy === "approve"} disabled={busy !== null || !draftText.trim()}>
                <Send className="h-4 w-4" aria-hidden /> Approve and send
              </Button>
              <Button variant="danger" size="lg" onClick={onDiscard} loading={busy === "discard"} disabled={busy !== null}>
                <Trash2 className="h-4 w-4" aria-hidden /> Discard
              </Button>
            </div>

            <div className="rounded-2xl bg-stone-50 p-4">
              <Eyebrow className="mb-2">Regenerate with a steer</Eyebrow>
              <div className="flex gap-2">
                <Input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Optional, for example: shorter and more formal"
                  disabled={busy !== null}
                  aria-label="Regeneration instruction"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onRegenerate(instruction);
                      setInstruction("");
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  className="group shrink-0"
                  onClick={() => {
                    onRegenerate(instruction);
                    setInstruction("");
                  }}
                  disabled={busy !== null}
                >
                  <RefreshCw className="h-4 w-4 transition-transform duration-500 ease-out-expo group-hover:rotate-180" aria-hidden /> Regenerate
                </Button>
              </div>
            </div>

            <Assessment draft={draft} />
            <KnowledgeUsed draft={draft} brandName={brand.name} />
          </div>
        )}
      </Tile>

      {history.length > 0 && <HistoryTile items={history} />}
    </div>
  );
}

const STEPS = ["Identifying the brand from the conversation", "Retrieving knowledge for this brand only", "Drafting with the language model", "Running guardrail checks"];

function GeneratingState({ brandName }: { brandName: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 650);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="space-y-5 py-1" aria-live="polite" aria-busy="true">
      <ol className="space-y-2.5">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className={clsx("flex items-center gap-3 text-sm transition-colors duration-300", done ? "text-stone-400" : active ? "text-stone-900" : "text-stone-300")}>
              <span
                className={clsx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white" : "border border-stone-200 bg-white",
                )}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : active ? <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" /> : null}
              </span>
              {i === 1 ? `Retrieving ${brandName} knowledge only` : label}
            </li>
          );
        })}
      </ol>
      <div className="space-y-2.5 rounded-2xl border border-hairline p-4">
        <Skeleton className="w-5/6" />
        <Skeleton className="w-full" />
        <Skeleton className="w-4/6" />
        <Skeleton className="w-3/6" />
      </div>
      <p className="flex items-center gap-2 text-xs text-stone-400">
        <PulseDots /> Drafting
      </p>
    </div>
  );
}

function FlagList({ flags, usedCount }: { flags: GuardrailFlag[]; usedCount: number }) {
  if (flags.length === 0) {
    return (
      <p className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          No guardrail flags. The model reports every claim is supported by {usedCount} cited knowledge {usedCount === 1 ? "entry" : "entries"} and
          the order facts.
        </span>
      </p>
    );
  }
  const sorted = [...flags].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return (
    <ul className="stagger space-y-2">
      {sorted.map((f, i) => {
        const Icon = f.severity === "info" ? Info : f.severity === "critical" ? ShieldAlert : AlertTriangle;
        return (
          <li
            key={`${f.code}-${i}`}
            className={clsx(
              "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs leading-relaxed",
              f.severity === "critical" && "border-rose-200 bg-rose-50 text-rose-800",
              f.severity === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
              f.severity === "info" && "border-sky-200 bg-sky-50 text-sky-800",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{f.code.replaceAll("_", " ").toLowerCase()}</span>
              <span className="mx-1.5 opacity-40">/</span>
              {f.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Assessment({ draft }: { draft: AiGeneration }) {
  const a = draft.assessment;
  return (
    <div>
      <TileHeader title="Model assessment" icon={Gauge} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={CONFIDENCE_TONE[a.confidence]}>confidence {a.confidence}</Badge>
        <Badge tone={a.grounded ? "success" : "danger"} icon={a.grounded ? CheckCircle2 : AlertTriangle}>
          {a.grounded ? "grounded" : "not grounded"}
        </Badge>
        {a.needsHumanReview && <Badge tone="warning">needs review</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Meta icon={Cpu} label="Model" value={draft.model} title={`${draft.provider} / ${draft.model}`} />
        <Meta icon={Clock} label="Latency" value={`${draft.latencyMs} ms`} />
        {draft.promptTokens != null && <Meta icon={Gauge} label="Tokens" value={`${draft.promptTokens} in, ${draft.completionTokens ?? 0} out`} />}
      </dl>
      {a.rationale && (
        <p className="mt-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs leading-relaxed text-stone-600">
          <span className="font-semibold text-stone-500">Why: </span>
          {a.rationale}
        </p>
      )}
      {draft.agentInstruction && (
        <p className="mt-2 text-xs text-stone-500">
          <span className="font-semibold">Your steer:</span> {draft.agentInstruction}
        </p>
      )}
    </div>
  );
}

function Meta({ icon: Icon, label, value, title }: { icon: typeof Cpu; label: string; value: string; title?: string }) {
  return (
    <div className="rounded-xl border border-hairline px-3 py-2" title={title}>
      <dt className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        <Icon className="h-3 w-3" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-[11px] text-stone-700">{value}</dd>
    </div>
  );
}

function KnowledgeUsed({ draft, brandName }: { draft: AiGeneration; brandName: string }) {
  const used = new Set(draft.assessment.usedEntryIds);
  const max = Math.max(...draft.retrievedContext.map((c) => c.score), 1);
  const statusCopy = {
    found: `Retrieved from the ${brandName} knowledge base only.`,
    weak: `Only a weak keyword match in the ${brandName} knowledge base. Treat with care.`,
    none: `Nothing in the ${brandName} knowledge base matched this question, so the assistant was told to write a holding reply.`,
  }[draft.retrievalStatus];

  return (
    <div>
      <TileHeader
        title="Knowledge used"
        icon={BookOpen}
        right={`${draft.retrievedContext.length} ${draft.retrievedContext.length === 1 ? "entry" : "entries"}`}
      />
      <p
        className={clsx(
          "mb-3 text-xs leading-relaxed",
          draft.retrievalStatus === "found" && "text-stone-500",
          draft.retrievalStatus === "weak" && "text-amber-800",
          draft.retrievalStatus === "none" && "text-rose-700",
        )}
      >
        {statusCopy}
      </p>
      <ul className="space-y-2">
        {draft.retrievedContext.map((c) => (
          <li key={c.entryId} className="rounded-2xl border border-hairline bg-white">
            <Disclosure
              summaryClassName="px-3.5 py-3"
              summary={
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      used.has(c.entryId) ? "bg-emerald-500 text-white" : "border border-stone-300 bg-white",
                    )}
                    title={used.has(c.entryId) ? "Cited by the model" : "Retrieved but not cited"}
                  >
                    {used.has(c.entryId) && <Check className="h-3 w-3" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-800">{c.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1 w-24 overflow-hidden rounded-full bg-stone-100">
                        <span
                          className="block h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out-expo"
                          style={{ width: `${Math.max(8, (c.score / max) * 100)}%` }}
                        />
                      </span>
                      <span className="tabular text-[10px] text-stone-400">{c.score.toFixed(1)}</span>
                      <Badge tone="neutral">{KB_CATEGORY_LABELS[c.category as KbCategory] ?? c.category}</Badge>
                    </span>
                  </span>
                </span>
              }
            >
              <div className="border-t border-hairline px-3.5 py-3 text-xs text-stone-600">
                <p className="whitespace-pre-wrap leading-relaxed">{c.content}</p>
                {c.matchedTerms.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-stone-400">matched</span>
                    {c.matchedTerms.map((t) => (
                      <span key={t} className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </Disclosure>
          </li>
        ))}
      </ul>
      <Disclosure className="mt-3" summaryClassName="text-[11px] text-stone-400" summary={<span>Retrieval query</span>}>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-stone-50 p-3 font-mono text-[11px] leading-relaxed text-stone-600">{draft.retrievalQuery}</p>
      </Disclosure>
    </div>
  );
}

function HistoryTile({ items }: { items: AiGeneration[] }) {
  return (
    <Tile className="p-5">
      <Disclosure
        summary={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-stone-400" aria-hidden />
            <Eyebrow>Previous drafts ({items.length})</Eyebrow>
          </span>
        }
      >
        <ul className="mt-4 space-y-2">
          {items.map((g) => (
            <li key={g.id} className="rounded-2xl border border-hairline p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={g.status === "approved" ? "success" : g.status === "discarded" ? "danger" : "neutral"}>{g.status}</Badge>
                <span className="tabular text-stone-400" suppressHydrationWarning>
                  {formatDateTime(g.createdAt)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 leading-relaxed text-stone-600">{g.finalResponse ?? g.aiResponse}</p>
            </li>
          ))}
        </ul>
      </Disclosure>
    </Tile>
  );
}
