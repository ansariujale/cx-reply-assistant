import { fail, handleError, ok, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { generationActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const generation = await getStore().getGeneration(id);
    return generation ? ok(generation) : fail(404, "Generation not found");
  } catch (err) {
    return handleError(err);
  }
}

/**
 * approve: records the (possibly edited) final text and posts it to the conversation.
 * discard: closes the draft without sending.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const parsed = await readJson(req, generationActionSchema);
    if (!parsed.ok) return parsed.response;
    const store = getStore();
    if (parsed.data.action === "approve") {
      const result = await store.approveGeneration(id, parsed.data.finalResponse);
      if (!result) return fail(409, "This draft is no longer open (already approved, discarded or superseded).");
      return ok(result);
    }
    const generation = await store.discardGeneration(id);
    if (!generation) return fail(409, "This draft is no longer open.");
    return ok({ generation });
  } catch (err) {
    return handleError(err);
  }
}
