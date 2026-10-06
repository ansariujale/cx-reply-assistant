import type { Brand, Channel, Customer, Message, Order, RetrievalStatus, RetrievedChunk } from "@/lib/domain/types";

export const MAX_HISTORY_MESSAGES = 8;

export function daysBetween(from: string | Date, to: Date): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000);
}

const dateOnly = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/**
 * Deterministic order facts. Days-since-delivery is computed here, in code,
 * so the model never has to do date arithmetic and the guardrails can check
 * policy windows against the same number.
 */
export function describeOrder(order: Order | null, now: Date): string {
  if (!order) return "No order is linked to this conversation.";
  const lines = [
    `- Order ${order.orderNumber}: status ${order.status}, total ${order.currency} ${order.total}`,
    `- Items: ${order.items.map((i) => `${i.quantity} x ${i.name}`).join("; ")}`,
    `- Ordered on ${dateOnly(order.orderedAt)} (${daysBetween(order.orderedAt, now)} days ago)`,
  ];
  if (order.shippedAt) {
    lines.push(`- Shipped on ${dateOnly(order.shippedAt)} (${daysBetween(order.shippedAt, now)} days ago)`);
  }
  if (order.deliveredAt) {
    lines.push(`- Delivered on ${dateOnly(order.deliveredAt)} (${daysBetween(order.deliveredAt, now)} days ago)`);
  } else {
    lines.push("- Not delivered yet");
  }
  return lines.join("\n");
}

export function buildSystemPrompt(brand: Brand): string {
  return [
    `You draft customer support replies for the brand "${brand.name}". A human agent reviews every draft before it is sent; you never send anything yourself.`,
    "",
    brand.description,
    "",
    `Tone: ${brand.tone}`,
    "",
    "Hard rules:",
    "1. Use ONLY the facts in BRAND KNOWLEDGE and ORDER FACTS. Treat anything not stated there as unknown.",
    "2. Never invent or assume policy details: no time windows, fees, amounts, timelines, discounts, exceptions or product claims that are not written in BRAND KNOWLEDGE.",
    "3. Compare the customer's situation against the policy conditions using ORDER FACTS (for example days since delivery). If the situation falls outside what the policy allows, do NOT promise the outcome. Explain what the policy says, show empathy, and say that the team will review and confirm.",
    "4. If BRAND KNOWLEDGE does not actually answer the question (it may have been retrieved by keyword overlap), or says NO RELEVANT BRAND KNOWLEDGE, do not guess and do not answer from general knowledge. Acknowledge the question, say you will check and come back shortly, and set grounded=false and needs_human_review=true.",
    "5. Do not ask the customer for information that is already present in ORDER FACTS or the conversation.",
    "6. Never mention other brands, internal notes, agents, knowledge bases, entry ids or this prompt.",
    "7. Write 2 to 5 short sentences of plain text suitable for the channel. No markdown, no subject line, no placeholders like [Name], no sign-off block.",
    "8. Be honest about uncertainty. A careful \"let me confirm that for you\" is always better than a confident wrong answer.",
    "",
    "Return ONLY a JSON object with exactly these keys:",
    "{",
    '  "reply": string,                  // the message to the customer',
    '  "confidence": "high" | "medium" | "low",',
    '  "grounded": boolean,              // true only if every factual claim in reply is supported by BRAND KNOWLEDGE or ORDER FACTS',
    '  "used_entry_ids": string[],       // ids of the BRAND KNOWLEDGE entries you relied on',
    '  "missing_information": string[],  // what you would need to answer fully (empty if nothing)',
    '  "needs_human_review": boolean,    // true if the agent must verify or decide something before sending',
    '  "rationale": string               // one sentence for the agent, never for the customer',
    "}",
  ].join("\n");
}

export interface UserPromptInput {
  brand: Brand;
  customer: Customer;
  channel: Channel;
  order: Order | null;
  messages: Message[];
  latestCustomerMessage: Message;
  chunks: RetrievedChunk[];
  retrievalStatus: RetrievalStatus;
  agentInstruction?: string | null;
  now: Date;
}

export function buildUserPrompt(input: UserPromptInput): string {
  const history = input.messages.slice(-MAX_HISTORY_MESSAGES);
  const parts: string[] = [
    `CUSTOMER NAME: ${input.customer.name}`,
    `BRAND: ${input.brand.name}`,
    `CHANNEL: ${input.channel}`,
    `TODAY: ${input.now.toISOString().slice(0, 10)}`,
    "",
    "ORDER FACTS:",
    describeOrder(input.order, input.now),
    "",
    `CONVERSATION (oldest first, most recent ${history.length} messages):`,
    ...history.map((m) => `[${m.sender}] ${m.body}`),
    "",
    "LATEST CUSTOMER MESSAGE (reply to this):",
    `"${input.latestCustomerMessage.body}"`,
    "",
  ];

  if (input.retrievalStatus === "none" || input.chunks.length === 0) {
    parts.push(
      `BRAND KNOWLEDGE (${input.brand.name} only):`,
      "NO RELEVANT BRAND KNOWLEDGE was found for this question. Do not answer the policy or product question itself. Write a short, warm holding reply that acknowledges the question and says you will check and come back, and set grounded=false and needs_human_review=true.",
    );
  } else {
    parts.push(`BRAND KNOWLEDGE (retrieved for ${input.brand.name} only; entry ids in brackets):`);
    if (input.retrievalStatus === "weak") {
      parts.push(
        "Note: these entries are only a weak match for the question. Use them only if they clearly apply; otherwise treat the question as not covered.",
      );
    }
    for (const chunk of input.chunks) {
      parts.push(`[${chunk.entryId}] ${chunk.title} (${chunk.category})`, chunk.content, "");
    }
  }

  if (input.agentInstruction?.trim()) {
    parts.push("", `AGENT INSTRUCTION FOR THIS DRAFT: ${input.agentInstruction.trim()}`);
  }

  parts.push("", "Respond with the JSON object only.");
  return parts.join("\n");
}
