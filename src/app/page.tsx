import { InboxBento } from "@/components/inbox/InboxBento";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const store = getStore();
  const [conversations, brands, generations] = await Promise.all([
    store.listConversations(),
    store.listBrands(),
    store.listGenerations({ limit: 500 }),
  ]);

  const stats = {
    open: conversations.filter((c) => c.status === "open").length,
    brands: brands.length,
    generated: generations.length,
    approved: generations.filter((g) => g.status === "approved").length,
    flagged: generations.filter((g) => g.flags.some((f) => f.severity === "critical")).length,
  };

  return <InboxBento conversations={conversations} brands={brands} stats={stats} />;
}
