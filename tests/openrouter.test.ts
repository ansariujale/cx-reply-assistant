import { describe, expect, it } from "vitest";
import { LlmError, OpenRouterClient } from "@/lib/ai/llm";

/**
 * The OpenRouter adapter against a fake fetch: request shape, JSON mode,
 * fallback models, retry policy and error mapping. No network access.
 */

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const completion = (content: string) => ({
  model: "openai/gpt-4o-mini",
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 120, completion_tokens: 40 },
});

const client = (impl: typeof fetch, extra: Partial<ConstructorParameters<typeof OpenRouterClient>[0]> = {}) =>
  new OpenRouterClient({
    apiKey: "sk-test",
    model: "openai/gpt-4o-mini",
    fallbackModels: ["google/gemini-2.5-flash-lite"],
    appUrl: "https://cx.example.com",
    fetchImpl: impl,
    ...extra,
  });

describe("OpenRouterClient", () => {
  it("sends an OpenAI-compatible JSON-mode request with fallback models and attribution headers", async () => {
    const { impl, calls } = fakeFetch([json(completion('{"reply":"hi"}'))]);
    const result = await client(impl).complete({ system: "SYS", user: "USER" });

    expect(result).toEqual({ text: '{"reply":"hi"}', model: "openai/gpt-4o-mini", promptTokens: 120, completionTokens: 40 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["HTTP-Referer"]).toBe("https://cx.example.com");
    expect(headers["X-Title"]).toBe("CX Reply Assistant");

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe("openai/gpt-4o-mini");
    expect(body.models).toEqual(["openai/gpt-4o-mini", "google/gemini-2.5-flash-lite"]);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.reasoning).toEqual({ enabled: false });
    expect(body.messages).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "USER" },
    ]);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(450);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never sends more than three models, which is OpenRouter's limit", async () => {
    const { impl, calls } = fakeFetch([json(completion("{}"))]);
    await client(impl, { fallbackModels: ["a/one:free", "b/two:free", "c/three:free", "d/four:free"] }).complete({ system: "s", user: "u" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.models).toEqual(["openai/gpt-4o-mini", "a/one:free", "b/two:free"]);
  });

  it("omits the models list when no fallbacks are configured", async () => {
    const { impl, calls } = fakeFetch([json(completion("{}"))]);
    await client(impl, { fallbackModels: [] }).complete({ system: "s", user: "u", temperature: 0, maxTokens: 50 });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.models).toBeUndefined();
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(50);
  });

  it("retries once on a 5xx and then succeeds", async () => {
    const { impl, calls } = fakeFetch([json({ error: "down" }, 503), json(completion("ok"))]);
    const result = await client(impl).complete({ system: "s", user: "u" });
    expect(result.text).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("gives up after the retry on persistent 429s with a retryable error", async () => {
    const { impl, calls } = fakeFetch([json({ error: "rate" }, 429), json({ error: "rate" }, 429)]);
    const err = await client(impl).complete({ system: "s", user: "u" }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("does not retry client errors such as 400/401", async () => {
    const { impl, calls } = fakeFetch([json({ error: { message: "bad key" } }, 401)]);
    const err = await client(impl).complete({ system: "s", user: "u" }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/401/);
    expect(calls).toHaveLength(1);
  });

  it("treats an error payload inside a 200 and an empty completion as transient failures", async () => {
    const { impl: a, calls: callsA } = fakeFetch([json({ error: { message: "provider overloaded" } }), json(completion("fine"))]);
    expect((await client(a).complete({ system: "s", user: "u" })).text).toBe("fine");
    expect(callsA).toHaveLength(2);

    const { impl: b } = fakeFetch([json({ choices: [{ message: { content: "" } }] }), json({ choices: [] })]);
    const err = await client(b).complete({ system: "s", user: "u" }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.message).toMatch(/empty completion/);
  });

  it("wraps network failures in a retryable LlmError after retrying", async () => {
    const { impl, calls } = fakeFetch([new TypeError("fetch failed"), new TypeError("fetch failed")]);
    const err = await client(impl).complete({ system: "s", user: "u" }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.retryable).toBe(true);
    expect(err.message).toMatch(/fetch failed/);
    expect(calls).toHaveLength(2);
  });
});
