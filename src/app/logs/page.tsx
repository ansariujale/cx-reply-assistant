import { GenerationLogTable, type ConversationMeta } from "@/components/logs/GenerationLogTable";
import { Eyebrow } from "@/components/ui";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const store = getStore();
  const [generations, conversations, brands] = await Promise.all([
    store.listGenerations({ limit: 200 }),
    store.listConversations(),
    store.listBrands(),
  ]);
  const meta: Record<string, ConversationMeta> = {};
  for (const c of conversations) {
    meta[c.id] = { customerName: c.customer.name, brandName: c.brand.name, brandColor: c.brand.accentColor, subject: c.subject };
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <Eyebrow>AI logs</Eyebrow>
        <h1 className="display mt-2 text-4xl font-semibold leading-[1.05] text-stone-900 sm:text-5xl">Every generation, with its evidence.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
          Each row stores the customer message, the knowledge retrieved, the raw AI response, the agent&apos;s edits, the final
          text and timestamps. This is the audit trail for debugging retrieval, tuning prompts and evaluating the assistant.
        </p>
      </header>
      <GenerationLogTable initial={generations} meta={meta} brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
