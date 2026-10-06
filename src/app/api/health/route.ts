import { getLlmClient } from "@/lib/ai/client";
import { ok } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Reports which adapters are active so reviewers can see mock vs real mode at a glance. */
export async function GET() {
  const store = getStore();
  const llm = getLlmClient();
  return ok({
    ok: true,
    store: store.kind,
    llm: { provider: llm.provider, model: llm.model },
    time: new Date().toISOString(),
  });
}
