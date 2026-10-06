import type { AiAssessment, AiGeneration } from "@/lib/domain/types";
import { retrieve } from "@/lib/retrieval/retrieve";
import { tokenize } from "@/lib/retrieval/tokenize";
import type { Store } from "@/lib/store/types";
import { runGuardrails } from "./guardrails";
import type { LlmClient, LlmResponse } from "./llm";
import { buildSystemPrompt, buildUserPrompt, describeOrder } from "./prompt";
import { extractJson, parseLlmOutput, type LlmOutput } from "./schema";

export interface GenerateReplyDeps {
  store: Store;
  llm: LlmClient;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export interface GenerateReplyParams {
  conversationId: string;
  /** Optional steer from the agent when regenerating, e.g. "shorter, more formal". */
  agentInstruction?: string | null;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export function holdingReply(firstName: string): string {
  return `Thanks for reaching out, ${firstName}. I want to make sure I give you accurate information on this, so I am checking with our team and will get back to you shortly.`;
}

const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] || "there";

/**
 * The AI reply pipeline:
 *   1. identify the brand (bound to the conversation, never inferred from text)
 *   2. retrieve knowledge for that brand only
 *   3. build a constrained prompt with deterministic order facts
 *   4. call the LLM (JSON mode, retry, repair, fallback)
 *   5. run deterministic guardrails and persist everything for audit
 */
export async function generateReply(deps: GenerateReplyDeps, params: GenerateReplyParams): Promise<AiGeneration> {
  const { store, llm } = deps;
  const now = deps.now?.() ?? new Date();

  const conversation = await store.getConversation(params.conversationId);
  if (!conversation) throw new GenerationError("Conversation not found", 404);

  // 1. Brand identification is structural: the conversation carries its brand.
  const brand = conversation.brand;

  const customerMessages = conversation.messages.filter((m) => m.sender === "customer");
  const latest = customerMessages.at(-1);
  if (!latest) throw new GenerationError("There is no customer message to reply to yet.", 400);

  // 2. Brand-scoped retrieval. Very short follow-ups borrow the previous customer message for context.
  let query = latest.body;
  if (tokenize(query).length < 3 && customerMessages.length > 1) {
    query = `${customerMessages.at(-2)!.body}\n${latest.body}`;
  }
  const entries = await store.listKbEntries(brand.id);
  const retrieval = retrieve(query, entries);
  const orderFacts = describeOrder(conversation.order, now);

  // 3. Prompt.
  const system = buildSystemPrompt(brand);
  const user = buildUserPrompt({
    brand,
    customer: conversation.customer,
    channel: conversation.channel,
    order: conversation.order,
    messages: conversation.messages,
    latestCustomerMessage: latest,
    chunks: retrieval.chunks,
    retrievalStatus: retrieval.status,
    agentInstruction: params.agentInstruction,
    now,
  });

  // 4. LLM call with one JSON-repair attempt and a hard fallback.
  const started = Date.now();
  let llmResult: LlmResponse | null = null;
  let output: LlmOutput | null = null;
  let rawText = "";
  let parseFailed = false;
  let llmFailed: string | null = null;

  try {
    llmResult = await llm.complete({ system, user });
    rawText = llmResult.text;
    let parsed = parseLlmOutput(rawText);
    if (!parsed.ok) {
      llmResult = await llm.complete({
        system,
        user: `${user}\n\nYour previous answer was not valid JSON (${parsed.error}). Return ONLY the JSON object described in the instructions.`,
        temperature: 0,
      });
      rawText = llmResult.text;
      parsed = parseLlmOutput(rawText);
    }
    if (parsed.ok) output = parsed.value;
    else parseFailed = true;
  } catch (err) {
    llmFailed = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Date.now() - started;

  const firstName = firstNameOf(conversation.customer.name);
  const retrievedIds = new Set(retrieval.chunks.map((c) => c.entryId));
  let reply: string;
  let assessment: AiAssessment;
  let modelOverridden = false;

  if (output) {
    reply = output.reply;
    assessment = {
      confidence: output.confidence,
      grounded: output.grounded,
      usedEntryIds: output.used_entry_ids.filter((id) => retrievedIds.has(id)),
      missingInformation: output.missing_information,
      needsHumanReview: output.needs_human_review,
      rationale: output.rationale,
    };
  } else if (parseFailed && rawText.trim()) {
    reply = (extractJson(rawText) ? rawText : rawText).replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
    assessment = {
      confidence: "low",
      grounded: false,
      usedEntryIds: [],
      missingInformation: ["The model output could not be parsed"],
      needsHumanReview: true,
      rationale: "Structured output was missing; the raw model text is shown instead.",
    };
  } else {
    reply = holdingReply(firstName);
    assessment = {
      confidence: "low",
      grounded: false,
      usedEntryIds: [],
      missingInformation: ["AI provider unavailable"],
      needsHumanReview: true,
      rationale: "Fallback holding reply because the AI provider did not respond.",
    };
  }

  // 5a. Policy enforced in code: with no knowledge there is nothing to be grounded on.
  if (retrieval.status === "none") {
    if (output && output.grounded) {
      modelOverridden = true;
      reply = holdingReply(firstName);
    }
    assessment = { ...assessment, grounded: false, confidence: "low", needsHumanReview: true, usedEntryIds: [] };
  }

  // 5b. Deterministic guardrails.
  const flags = runGuardrails({
    reply,
    assessment,
    retrievalStatus: retrieval.status,
    chunks: retrieval.chunks,
    orderFacts,
    order: conversation.order,
    customerMessage: latest.body,
    now,
    parseFailed,
    llmFailed,
    modelOverridden,
  });

  // 5c. Persist for audit; any earlier open draft is superseded.
  await store.supersedeDrafts(conversation.id);
  return store.createGeneration({
    conversationId: conversation.id,
    brandId: brand.id,
    customerMessageId: latest.id,
    customerMessage: latest.body,
    retrievalQuery: retrieval.query,
    retrievalStatus: retrieval.status,
    retrievedContext: retrieval.chunks,
    provider: llm.provider,
    model: llmResult?.model ?? llm.model,
    promptTokens: llmResult?.promptTokens ?? null,
    completionTokens: llmResult?.completionTokens ?? null,
    latencyMs,
    aiResponse: reply,
    assessment,
    flags,
    agentInstruction: params.agentInstruction?.trim() || null,
  });
}
