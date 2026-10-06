import { handleError, ok } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Audit log of AI generations, newest first. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100) || 100;
    return ok(await getStore().listGenerations({ conversationId, limit }));
  } catch (err) {
    return handleError(err);
  }
}
