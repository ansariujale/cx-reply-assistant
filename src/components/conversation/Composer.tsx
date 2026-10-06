"use client";

import clsx from "clsx";
import { Headset, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button, Kbd, Segmented, TextArea } from "@/components/ui";
import type { Busy } from "./ConversationWorkspace";

export type ComposerMode = "agent" | "customer";

interface Props {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onGenerate: () => void;
  busy: Busy;
  customerName: string;
  hasDraft: boolean;
}

const MIN_HEIGHT = 64;
const MAX_HEIGHT = 180;

/**
 * One composer, two sides. The customer side exists so reviewers can drive the
 * AI loop end to end (new question, generate, approve) without seeding data.
 * The textarea starts compact and grows with the text so the thread above keeps its room.
 */
export function Composer({ mode, onModeChange, value, onChange, onSend, onGenerate, busy, customerName, hasDraft }: Props) {
  const isCustomer = mode === "customer";
  const disabled = busy !== null;
  const firstName = customerName.split(" ")[0];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text, but only once there is text: an empty textarea keeps its compact size.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value, mode]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && value.trim()) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={clsx("shrink-0 border-t px-5 py-3.5 transition-colors duration-300", isCustomer ? "border-amber-200 bg-amber-50/70" : "border-hairline bg-stone-50/60")}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          ariaLabel="Compose as"
          value={mode}
          onChange={onModeChange}
          tone={isCustomer ? "amber" : "neutral"}
          options={[
            { value: "agent", label: "Agent", icon: Headset },
            { value: "customer", label: "Simulate customer", icon: User },
          ]}
        />
        <p className={clsx("hidden text-xs transition-colors sm:block", isCustomer ? "text-amber-900" : "text-stone-500")}>
          {isCustomer ? (
            <>
              Writing as <span className="font-semibold">{customerName}</span> to test the loop
            </>
          ) : (
            "Reply by hand or let the assistant draft one"
          )}
        </p>
      </div>

      <TextArea
        ref={textareaRef}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={
          isCustomer
            ? `Type a new message from ${firstName}, for example: I received this 20 days ago, can I get a refund?`
            : "Write a manual reply to the customer"
        }
        className={clsx("overflow-y-auto", isCustomer && "border-amber-300 focus:border-amber-500 focus:ring-amber-500/15")}
        style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        aria-label={isCustomer ? "Message as customer" : "Manual agent reply"}
      />

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-400">
          <Kbd>Ctrl</Kbd>
          <span>+</span>
          <Kbd>Enter</Kbd>
          <span className="ml-1">to send</span>
        </span>
        <div className="flex items-center gap-2">
          {isCustomer ? (
            <Button variant="primary" onClick={onSend} loading={busy === "send"} disabled={disabled || !value.trim()}>
              <Send className="h-4 w-4" aria-hidden /> Send as customer
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onSend} loading={busy === "send"} disabled={disabled || !value.trim()}>
                <Send className="h-4 w-4" aria-hidden /> Send manually
              </Button>
              <Button variant="accent" onClick={onGenerate} loading={busy === "generate"} disabled={disabled}>
                <Sparkles className="h-4 w-4" aria-hidden /> {hasDraft ? "Regenerate AI reply" : "Generate AI reply"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
