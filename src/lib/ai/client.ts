import { getEnv } from "@/lib/env";
import { MockLlmClient, OpenRouterClient, type LlmClient } from "./llm";

type GlobalWithLlm = typeof globalThis & { __cxLlm?: LlmClient };

/** Process-wide LLM client: OpenRouter when a key is configured, otherwise the labelled mock. */
export function getLlmClient(): LlmClient {
  const g = globalThis as GlobalWithLlm;
  if (g.__cxLlm) return g.__cxLlm;
  const env = getEnv();
  const client: LlmClient = env.openRouterApiKey
    ? new OpenRouterClient({
        apiKey: env.openRouterApiKey,
        model: env.openRouterModel,
        fallbackModels: env.openRouterFallbackModels,
        appUrl: env.appUrl,
      })
    : new MockLlmClient();
  g.__cxLlm = client;
  return client;
}
