import { fail, handleError, ok, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { messageBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Posts a human-written message as either side of the conversation.
 * Customer messages let reviewers drive the AI loop end-to-end; agent
 * messages are manual replies written independently of the AI.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const store = getStore();
    if (!(await store.getConversation(id))) return fail(404, "Conversation not found");
    const parsed = await readJson(req, messageBodySchema);
    if (!parsed.ok) return parsed.response;
    const message = await store.addMessage({
      conversationId: id,
      sender: parsed.data.sender,
      body: parsed.data.body,
      source: "human",
    });
    return ok(message, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
