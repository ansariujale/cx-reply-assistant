"use client";

import clsx from "clsx";
import { Bot, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface Health {
  store: "memory" | "postgres";
  llm: { provider: string; model: string };
}

function Pill({ live, icon: Icon, label, title }: { live: boolean; icon: typeof Bot; label: string; title: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {!live && <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-amber-500" />}
        <span className={clsx("relative inline-flex h-1.5 w-1.5 rounded-full", live ? "bg-emerald-500" : "bg-amber-500")} />
      </span>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/** Shows which adapters are live so nobody mistakes mock output for a real model. */
export function ModeBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    api<Health>("/api/health").then(setHealth).catch(() => setHealth(null));
  }, []);
  if (!health) return null;
  const mock = health.llm.provider === "mock";
  const memory = health.store === "memory";
  return (
    <div className="hidden animate-fade-in items-center gap-2 md:flex">
      <Pill
        live={!memory}
        icon={Database}
        label={memory ? "memory store" : "postgres"}
        title={memory ? "In-memory store: data resets on restart. Set DATABASE_URL for persistence." : "Postgres store"}
      />
      <Pill
        live={!mock}
        icon={Bot}
        label={mock ? "mock model" : health.llm.model}
        title={mock ? "Mock LLM: deterministic stand-in. Set OPENROUTER_API_KEY for real generations." : `OpenRouter: ${health.llm.model}`}
      />
    </div>
  );
}
