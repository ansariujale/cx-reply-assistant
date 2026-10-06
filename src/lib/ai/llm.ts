/**
 * LLM port + two adapters.
 *
 * - OpenRouterClient: production. OpenAI-compatible chat completions with JSON
 *   mode, a per-request timeout, one retry on transient failures, and
 *   OpenRouter's model fallback list for provider outages.
 * - MockLlmClient: deterministic stand-in used when no API key is configured
 *   and in tests, so the full UI loop works with zero credentials. The UI
 *   labels it clearly; it must never be used for real customers.
 */

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/* ------------------------------------------------------------------ */
/* OpenRouter                                                          */
/* ------------------------------------------------------------------ */

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  appUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
}

export class OpenRouterClient implements LlmClient {
  readonly provider = "openrouter";
  readonly model: string;
  private readonly fallbackModels: string[];
  private readonly appUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: OpenRouterOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.fallbackModels = (opts.fallbackModels ?? []).filter((m) => m && m !== opts.model);
    this.appUrl = opts.appUrl ?? "http://localhost:3000";
    this.timeoutMs = opts.timeoutMs ?? 25_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    // OpenRouter accepts at most 3 entries in the fallback list.
    const models = [this.model, ...this.fallbackModels].slice(0, 3);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      temperature: req.temperature ?? 0.3,
      // A reply is 2 to 5 sentences plus a small JSON envelope; 450 leaves headroom
      // while keeping the per-call reservation (and worst-case cost) small.
      max_tokens: req.maxTokens ?? 450,
      response_format: { type: "json_object" },
      // Drafting a short grounded reply does not need hidden chain-of-thought. Reasoning models
      // otherwise spend the whole token budget thinking and return empty content; OpenRouter
      // ignores this for models without a reasoning mode.
      reasoning: { enabled: false },
    };
    if (models.length > 1) body.models = models;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": this.appUrl,
            "X-Title": "CX Reply Assistant",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
          throw new LlmError(`OpenRouter responded ${res.status}: ${text.slice(0, 300)}`, res.status, retryable);
        }

        const data = (await res.json()) as OpenRouterResponse;
        if (data.error) {
          throw new LlmError(`OpenRouter error: ${data.error.message ?? "unknown"}`, null, true);
        }
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new LlmError("OpenRouter returned an empty completion", null, true);
        }
        return {
          text: content,
          model: data.model ?? this.model,
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
        };
      } catch (err) {
        lastError = err;
        // Network errors and timeouts surface as generic errors: treat them as transient.
        const retryable = err instanceof LlmError ? err.retryable : true;
        if (!retryable || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    if (lastError instanceof LlmError) throw lastError;
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new LlmError(`OpenRouter request failed: ${message}`, null, true);
  }
}

/* ------------------------------------------------------------------ */
/* Mock                                                                */
/* ------------------------------------------------------------------ */

export class MockLlmClient implements LlmClient {
  readonly provider = "mock";
  readonly model = "mock-deterministic";

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const firstName = /CUSTOMER NAME:\s*(.+)/.exec(req.user)?.[1]?.trim().split(/\s+/)[0] ?? "there";
    const ids = [...req.user.matchAll(/^\[(kb_[A-Za-z0-9_]+)\]/gm)].map((m) => m[1]);

    let output: Record<string, unknown>;
    if (ids.length === 0) {
      output = {
        reply: `Thanks for reaching out, ${firstName}. I want to make sure I give you accurate information on this, so I am checking with our team and will get back to you shortly.`,
        confidence: "low",
        grounded: false,
        used_entry_ids: [],
        missing_information: ["No brand knowledge covers this question"],
        needs_human_review: true,
        rationale: "Mock LLM: no knowledge was retrieved, so this is a holding reply.",
      };
    } else {
      const excerpt = new RegExp(`^\\[${ids[0]}\\][^\\n]*\\n([^\\n]+)`, "m").exec(req.user)?.[1] ?? "";
      const firstSentence = excerpt.split(/(?<=\.)\s+/)[0] ?? excerpt;
      output = {
        reply: `Hi ${firstName}, thanks for letting us know and sorry for the trouble. Here is what applies in this case: ${firstSentence} Let me know if you would like me to take this forward for you.`,
        confidence: "medium",
        grounded: true,
        used_entry_ids: [ids[0]],
        missing_information: [],
        needs_human_review: false,
        rationale: "Mock LLM: deterministic reply built from the top retrieved policy excerpt. Set OPENROUTER_API_KEY for real generations.",
      };
    }

    const text = JSON.stringify(output);
    return {
      text,
      model: this.model,
      promptTokens: Math.ceil((req.system.length + req.user.length) / 4),
      completionTokens: Math.ceil(text.length / 4),
    };
  }
}
