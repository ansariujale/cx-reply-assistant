"use client";

import clsx from "clsx";
import { Headset, Sparkles } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import type { Message } from "@/lib/domain/types";
import { SOURCE_LABELS, dayLabel, formatTime } from "@/lib/format";

export function MessageThread({ messages, customerName, brandColor }: { messages: Message[]; customerName: string; brandColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Scroll only the thread itself to the newest message, never the page,
  // so the conversation title never jumps under the sticky header on load.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstRender.current ? "auto" : "smooth" });
    firstRender.current = false;
  }, [messages.length]);

  const firstName = customerName.split(" ")[0];

  return (
    <div ref={containerRef} className="scroll-thin min-h-[360px] flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
      {messages.length === 0 && (
        <p className="py-16 text-center text-sm text-stone-400">No messages yet. Send one as the customer to start.</p>
      )}
      {messages.map((m, i) => {
        const isAgent = m.sender === "agent";
        const ai = m.source !== "human";
        const previous = messages[i - 1];
        const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(m.createdAt);
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="flex items-center gap-3 py-1" suppressHydrationWarning>
                <span className="h-px flex-1 bg-stone-200" />
                <span className="eyebrow">{dayLabel(m.createdAt)}</span>
                <span className="h-px flex-1 bg-stone-200" />
              </div>
            )}
            <div className={clsx("flex animate-pop", isAgent ? "justify-end" : "justify-start")}>
              <div className={clsx("flex max-w-[82%] flex-col", isAgent ? "items-end" : "items-start")}>
                <div
                  className={clsx(
                    "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isAgent
                      ? "rounded-br-md bg-stone-900 text-white shadow-[0_8px_20px_-12px_rgb(28_25_23/0.6)]"
                      : "rounded-bl-md border border-hairline bg-white text-stone-800 shadow-tile",
                  )}
                >
                  {m.body}
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                  {isAgent ? (
                    <Headset className="h-3 w-3" aria-hidden />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} aria-hidden />
                  )}
                  <span className="font-medium text-stone-500">{isAgent ? "Agent" : firstName}</span>
                  <span className="tabular" suppressHydrationWarning>
                    {formatTime(m.createdAt)}
                  </span>
                  {isAgent && (
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold",
                        ai ? "bg-indigo-50 text-indigo-700" : "bg-stone-100 text-stone-600",
                      )}
                      title={SOURCE_LABELS[m.source]}
                    >
                      {ai && <Sparkles className="h-2.5 w-2.5" aria-hidden />}
                      {m.source === "human" ? "manual" : m.source === "ai_approved" ? "AI, approved" : "AI, edited"}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
