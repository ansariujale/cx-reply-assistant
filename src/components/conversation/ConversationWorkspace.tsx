"use client";

import { ArrowLeft, Globe, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { AiGeneration, ConversationDetail, Message } from "@/lib/domain/types";
import { CHANNEL_LABELS } from "@/lib/format";
import { TimeAgo } from "@/components/TimeAgo";
import { useToast } from "@/components/toast";
import { Badge, BrandChip, ErrorNote } from "@/components/ui";
import { AiDraftPanel } from "./AiDraftPanel";
import { Composer, type ComposerMode } from "./Composer";
import { ContextTiles } from "./ContextTiles";
import { MessageThread } from "./MessageThread";

export interface WorkspaceData {
  conversation: ConversationDetail;
  draft: AiGeneration | null;
  generations: AiGeneration[];
}

export type Busy = null | "send" | "generate" | "approve" | "discard";

const CHANNEL_ICON = { whatsapp: Phone, email: Mail, web: Globe } as const;

export function ConversationWorkspace({ initial }: { initial: WorkspaceData }) {
  const [data, setData] = useState<WorkspaceData>(initial);
  const [mode, setMode] = useState<ComposerMode>("agent");
  const [composer, setComposer] = useState("");
  const [draftText, setDraftText] = useState(initial.draft?.aiResponse ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const { conversation, draft, generations } = data;
  const id = conversation.id;
  const ChannelIcon = CHANNEL_ICON[conversation.channel];

  // A new draft replaces whatever the agent was editing.
  useEffect(() => {
    setDraftText(draft?.aiResponse ?? "");
  }, [draft?.id, draft?.aiResponse]);

  const refresh = useCallback(async () => {
    const next = await api<WorkspaceData>(`/api/conversations/${id}`);
    setData(next);
  }, [id]);

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.push({ tone: "error", title: "That did not work", description: message });
    } finally {
      setBusy(null);
    }
  }

  const send = () =>
    run("send", async () => {
      const body = composer.trim();
      if (!body) return;
      await api<Message>(`/api/conversations/${id}/messages`, { method: "POST", json: { sender: mode, body } });
      setComposer("");
      await refresh();
      if (mode === "customer") {
        // After simulating the customer, the natural next step is to answer as the agent.
        setMode("agent");
        toast.push({ tone: "info", title: "Message sent as the customer", description: "Switched back to the agent side so you can reply." });
      } else {
        toast.push({ tone: "success", title: "Manual reply sent" });
      }
    });

  const generate = (instruction?: string) =>
    run("generate", async () => {
      const g = await api<AiGeneration>(`/api/conversations/${id}/generate`, {
        method: "POST",
        json: { instruction: instruction?.trim() || null },
      });
      await refresh();
      const critical = g.flags.filter((f) => f.severity === "critical").length;
      toast.push({
        tone: critical ? "error" : "success",
        title: critical ? "Draft ready, with critical flags" : "Draft ready for review",
        description: critical ? "Read the flags before sending anything." : `${g.retrievedContext.length} knowledge ${g.retrievedContext.length === 1 ? "entry" : "entries"} used.`,
      });
    });

  const approve = () =>
    run("approve", async () => {
      if (!draft) return;
      await api(`/api/generations/${draft.id}`, { method: "PATCH", json: { action: "approve", finalResponse: draftText } });
      await refresh();
      toast.push({ tone: "success", title: "Reply approved and sent", description: "It now appears in the conversation thread." });
    });

  const discard = () =>
    run("discard", async () => {
      if (!draft) return;
      await api(`/api/generations/${draft.id}`, { method: "PATCH", json: { action: "discard" } });
      await refresh();
      toast.push({ tone: "info", title: "Draft discarded" });
    });

  return (
    <div className="space-y-6">
      <header className="flex animate-fade-up flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-stone-900">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to inbox
          </Link>
          <h1 className="display mt-2 text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">{conversation.subject}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BrandChip name={conversation.brand.name} color={conversation.brand.accentColor} />
            <Badge tone={conversation.status === "open" ? "info" : "neutral"}>{conversation.status}</Badge>
            <Badge tone="neutral" icon={ChannelIcon}>
              {CHANNEL_LABELS[conversation.channel]}
            </Badge>
            <span className="text-xs text-stone-400">
              Opened <TimeAgo iso={conversation.createdAt} />
            </span>
          </div>
        </div>
      </header>

      <ErrorNote message={error} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-3 xl:grid-cols-1">
          <ContextTiles conversation={conversation} />
        </div>

        <section
          className="tile flex min-h-[680px] animate-fade-up flex-col overflow-hidden xl:col-span-5 xl:h-[calc(100vh-9.5rem)]"
          style={{ animationDelay: "120ms" }}
          aria-label="Conversation thread"
        >
          <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <div>
              <p className="display text-base font-semibold text-stone-900">{conversation.customer.name}</p>
              <p className="text-xs text-stone-500">
                {conversation.messages.length} message{conversation.messages.length === 1 ? "" : "s"} in this thread. Brand resolved from the{" "}
                {CHANNEL_LABELS[conversation.channel]} channel.
              </p>
            </div>
          </header>
          <MessageThread messages={conversation.messages} customerName={conversation.customer.name} brandColor={conversation.brand.accentColor} />
          <Composer
            mode={mode}
            onModeChange={setMode}
            value={composer}
            onChange={setComposer}
            onSend={send}
            onGenerate={() => generate()}
            busy={busy}
            customerName={conversation.customer.name}
            hasDraft={Boolean(draft)}
          />
        </section>

        <div className="animate-fade-up xl:col-span-4" style={{ animationDelay: "200ms" }}>
          <AiDraftPanel
            brand={conversation.brand}
            draft={draft}
            history={generations.filter((g) => g.id !== draft?.id)}
            draftText={draftText}
            onDraftTextChange={setDraftText}
            onApprove={approve}
            onDiscard={discard}
            onRegenerate={(instruction) => generate(instruction)}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}
