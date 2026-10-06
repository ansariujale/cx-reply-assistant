import { fail, handleError, ok } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Conversation detail plus the open AI draft (if any) and recent generation history. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const store = getStore();
    const conversation = await store.getConversation(id);
    if (!conversation) return fail(404, "Conversation not found");
    const generations = await store.listGenerations({ conversationId: id, limit: 20 });
    const draft = generations.find((g) => g.status === "draft") ?? null;
    return ok({ conversation, draft, generations });
  } catch (err) {
    return handleError(err);
  }
}
