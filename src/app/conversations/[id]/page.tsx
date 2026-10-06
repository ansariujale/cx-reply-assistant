import { notFound } from "next/navigation";
import { ConversationWorkspace } from "@/components/conversation/ConversationWorkspace";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const conversation = await store.getConversation(id);
  if (!conversation) notFound();
  const generations = await store.listGenerations({ conversationId: id, limit: 20 });
  const draft = generations.find((g) => g.status === "draft") ?? null;
  return <ConversationWorkspace initial={{ conversation, draft, generations }} />;
}
