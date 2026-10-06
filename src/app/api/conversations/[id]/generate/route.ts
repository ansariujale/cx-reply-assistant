import { getLlmClient } from "@/lib/ai/client";
import { generateReply } from "@/lib/ai/generateReply";
import { getEnv } from "@/lib/env";
import { clientIp, fail, handleError, ok, readJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rateLimit";
import { getStore } from "@/lib/store";
import { generateBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Runs the full AI pipeline for a conversation and returns the new draft generation. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const limit = checkRateLimit(`generate:${clientIp(req)}`, getEnv().generateRateLimitPerMinute);
    if (!limit.allowed) {
      return fail(429, `Too many AI requests. Try again in ${limit.retryAfterSec}s.`);
    }
    const parsed = await readJson(req, generateBodySchema);
    if (!parsed.ok) return parsed.response;
    const generation = await generateReply(
      { store: getStore(), llm: getLlmClient() },
      { conversationId: id, agentInstruction: parsed.data.instruction ?? null },
    );
    return ok(generation, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
