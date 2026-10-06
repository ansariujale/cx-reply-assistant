"use client";

import { ArrowUpRight, Globe, Headset, Mail, MessageSquare, Phone, ShieldCheck, Sparkles, User } from "lucide-react";
import Link from "next/link";
import type { Brand, ConversationSummary } from "@/lib/domain/types";
import { CHANNEL_LABELS, percent } from "@/lib/format";
import { TimeAgo } from "@/components/TimeAgo";
import { Badge, BrandChip, Eyebrow, Stat, Tile } from "@/components/ui";

const CHANNEL_ICON = { whatsapp: Phone, email: Mail, web: Globe } as const;

export interface InboxStats {
  open: number;
  brands: number;
  generated: number;
  approved: number;
  flagged: number;
}

const STEPS = [
  { icon: User, title: "Speak as the customer", body: "Open a conversation, switch the composer to Simulate customer and send a new message." },
  { icon: Sparkles, title: "Generate as the agent", body: "Switch back to Agent and click Generate AI reply. Review the draft, the retrieved knowledge and any guardrail flags." },
  { icon: Headset, title: "Approve or reply by hand", body: "Edit the draft and approve it, or write a manual reply. Nothing reaches the customer without you." },
];

export function InboxBento({ conversations, brands, stats }: { conversations: ConversationSummary[]; brands: Brand[]; stats: InboxStats }) {
  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <Eyebrow>Inbox</Eyebrow>
        <h1 className="display mt-2 text-4xl font-semibold leading-[1.05] text-stone-900 sm:text-5xl">
          {stats.open === 0 ? "All caught up." : `${stats.open} conversation${stats.open === 1 ? "" : "s"} waiting for a reply.`}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
          Each conversation is bound to one brand, and the assistant only ever sees that brand&apos;s knowledge. Open one to
          draft, review and send.
        </p>
      </header>

      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-6">
        <Tile className="p-6 md:col-span-3 lg:col-span-2">
          <Stat
            label="Open conversations"
            value={stats.open}
            icon={MessageSquare}
            tone="accent"
            hint={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {brands.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.accentColor }} />
                    {b.name}
                  </span>
                ))}
              </span>
            }
          />
        </Tile>

        <Tile className="p-6 md:col-span-3 lg:col-span-2">
          <Stat
            label="AI drafts generated"
            value={stats.generated}
            icon={ShieldCheck}
            tone="success"
            hint={
              stats.generated === 0
                ? "No drafts yet. Every generation is logged with its evidence."
                : `${stats.approved} approved (${percent(stats.approved, stats.generated)}), ${stats.flagged} held back by critical flags.`
            }
          />
        </Tile>

        <Tile className="flex flex-col p-6 md:col-span-6 lg:col-span-2 lg:row-span-2">
          <Eyebrow>Test the loop end to end</Eyebrow>
          <ol className="mt-5 flex flex-1 flex-col gap-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="display w-7 shrink-0 text-2xl font-semibold leading-none text-stone-300 tabular">0{i + 1}</span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                    <step.icon className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Tile>

        {conversations.map((c) => {
          const Icon = CHANNEL_ICON[c.channel];
          const last = c.lastMessage;
          return (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              className="tile tile-hover group flex flex-col p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:col-span-3 lg:col-span-2"
            >
              <div className="flex items-center justify-between gap-3">
                <BrandChip name={c.brand.name} color={c.brand.accentColor} />
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {CHANNEL_LABELS[c.channel]}
                </span>
              </div>
              <h2 className="display mt-5 text-2xl font-semibold leading-tight text-stone-900">{c.customer.name}</h2>
              <p className="mt-1 text-sm text-stone-500">{c.subject}</p>
              {last && (
                <blockquote className="mt-4 line-clamp-3 rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-700">
                  <span className="font-semibold text-stone-500">{last.sender === "customer" ? c.customer.name.split(" ")[0] : "Agent"}</span>{" "}
                  {last.body}
                </blockquote>
              )}
              <div className="mt-auto flex items-center justify-between pt-5 text-xs text-stone-400">
                <span className="flex items-center gap-2">
                  <Badge tone={c.status === "open" ? "info" : "neutral"}>{c.status}</Badge>
                  <span>
                    {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <TimeAgo iso={c.updatedAt} />
                  <ArrowUpRight className="h-4 w-4 text-stone-300 transition-all duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-600" aria-hidden />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
