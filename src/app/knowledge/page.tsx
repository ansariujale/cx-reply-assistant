import { KnowledgeManager } from "@/components/knowledge/KnowledgeManager";
import { Eyebrow } from "@/components/ui";
import type { KbEntry } from "@/lib/domain/types";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const store = getStore();
  const brands = await store.listBrands();
  const entriesByBrand: Record<string, KbEntry[]> = {};
  for (const b of brands) entriesByBrand[b.id] = await store.listKbEntries(b.id);

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <Eyebrow>Knowledge base</Eyebrow>
        <h1 className="display mt-2 text-4xl font-semibold leading-[1.05] text-stone-900 sm:text-5xl">What the assistant is allowed to say.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
          Policies per brand. Changes apply to the very next generation: edit a refund window here and re-test without touching
          code or the database. Retrieval matches on title, tags and content, so add tags for the words customers actually use.
        </p>
      </header>
      <KnowledgeManager brands={brands} initialEntries={entriesByBrand} />
    </div>
  );
}
