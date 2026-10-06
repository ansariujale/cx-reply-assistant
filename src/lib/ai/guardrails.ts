import type { AiAssessment, GuardrailFlag, Order, RetrievalStatus, RetrievedChunk } from "@/lib/domain/types";

/**
 * Deterministic post-generation checks. The model's own self-assessment is
 * useful but cannot be trusted on its own, so these checks run in code and
 * are shown to the agent next to the draft. They never block: the agent is
 * the final decision maker, but they make the risk visible.
 */

export interface GuardrailContext {
  reply: string;
  assessment: AiAssessment;
  retrievalStatus: RetrievalStatus;
  chunks: RetrievedChunk[];
  orderFacts: string;
  order: Order | null;
  customerMessage: string;
  now: Date;
  parseFailed?: boolean;
  llmFailed?: string | null;
  modelOverridden?: boolean;
}

const PROMISE_PATTERNS: RegExp[] = [
  /\b(we|i)\s+(will|'ll|can|have|are going to)\s+(issue|process|send|arrange|refund|replace|ship|dispatch|credit)\b/i,
  /\byou\s+(will|'ll|can)\s+(receive|get|expect)\s+(a\s+|your\s+|the\s+)?(full\s+)?(refund|replacement|credit|new)\b/i,
  /\b(full|complete)\s+refund\b/i,
  /\bguarantee/i,
  /\bdefinitely\b/i,
  /\brefund(ed)?\s+(has been|is being|will be)\b/i,
  /\b(eligible for|entitled to)\s+(a\s+)?(full\s+)?(refund|replacement)\b/i,
];

const COMMITMENT_TOPIC = /\b(refund|return|replace|replacement|credit|exchange)/i;

/** "no longer eligible for a refund" is a correct refusal, not a promise. */
const NEGATION = /\b(not|no longer|cannot|can't|won't|isn't|aren't|wasn't|never|unable|unfortunately)\b/i;

/** True when some sentence commits to an outcome without negating it. */
export function containsPromise(text: string): boolean {
  return text
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => !NEGATION.test(sentence) && PROMISE_PATTERNS.some((p) => p.test(sentence)));
}

/** Windows explicitly tied to delivery, e.g. "within 7 days of delivery", "within 48 hours of delivery". */
const DELIVERY_WINDOW = /within\s+(\d+)\s+(hours?|days?)\s+of\s+(delivery|receiving|receipt)/gi;

export function extractNumbers(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (!Number.isNaN(n)) out.add(String(n));
  }
  return out;
}

export function runGuardrails(ctx: GuardrailContext): GuardrailFlag[] {
  const flags: GuardrailFlag[] = [];
  const { reply, assessment, retrievalStatus, chunks } = ctx;

  if (ctx.llmFailed) {
    flags.push({
      code: "LLM_UNAVAILABLE",
      severity: "critical",
      message: `The AI provider failed (${ctx.llmFailed}). This is a generic holding reply, not policy guidance.`,
    });
  }
  if (ctx.parseFailed) {
    flags.push({
      code: "MALFORMED_OUTPUT",
      severity: "critical",
      message: "The model did not return the expected structured output, so confidence and grounding could not be verified.",
    });
  }
  if (ctx.modelOverridden) {
    flags.push({
      code: "MODEL_OVERRIDDEN",
      severity: "critical",
      message: "The model claimed to be grounded although no brand knowledge was retrieved. Its draft was replaced with a holding reply.",
    });
  }

  if (retrievalStatus === "none") {
    flags.push({
      code: "NO_KNOWLEDGE",
      severity: "critical",
      message: "No brand knowledge matched this question. The draft is a holding reply; check with the team before committing to anything.",
    });
  } else if (retrievalStatus === "weak") {
    flags.push({
      code: "WEAK_RETRIEVAL",
      severity: "warning",
      message: "Only a weak knowledge match was found. Verify that the quoted policy actually applies to this question.",
    });
  }

  if (!assessment.grounded && !ctx.llmFailed) {
    flags.push({
      code: "UNGROUNDED",
      severity: "critical",
      message: "The model reports that parts of this reply are not supported by brand knowledge or order facts.",
    });
  }
  if (assessment.confidence === "low" && !ctx.llmFailed) {
    flags.push({ code: "LOW_CONFIDENCE", severity: "warning", message: "The model rated its own confidence as low." });
  }
  if (assessment.needsHumanReview && !ctx.llmFailed) {
    flags.push({
      code: "NEEDS_REVIEW",
      severity: "warning",
      message: assessment.rationale
        ? `The model asked for human review: ${assessment.rationale}`
        : "The model asked for human review before sending.",
    });
  }
  if (assessment.missingInformation.length > 0) {
    flags.push({
      code: "MISSING_INFO",
      severity: "info",
      message: `Information the model says it lacks: ${assessment.missingInformation.join("; ")}.`,
    });
  }

  // Figures in the reply must come from somewhere we can point to.
  const allowed = new Set<string>([
    ...extractNumbers(chunks.map((c) => `${c.title} ${c.content}`).join(" ")),
    ...extractNumbers(ctx.orderFacts),
    ...extractNumbers(ctx.customerMessage),
    ...extractNumbers(String(ctx.now.getFullYear())),
  ]);
  const unsupported = [...extractNumbers(reply)].filter((n) => !allowed.has(n));
  if (unsupported.length > 0) {
    flags.push({
      code: "UNSUPPORTED_NUMBERS",
      severity: "warning",
      message: `The reply contains figures that do not appear in the retrieved knowledge or order facts: ${unsupported.join(", ")}.`,
    });
  }

  // Policy windows that are tied to delivery, checked against real elapsed time.
  if (ctx.order?.deliveredAt && COMMITMENT_TOPIC.test(reply)) {
    const hoursSince = (ctx.now.getTime() - new Date(ctx.order.deliveredAt).getTime()) / 3_600_000;
    const exceeded: string[] = [];
    for (const chunk of chunks) {
      for (const m of chunk.content.matchAll(DELIVERY_WINDOW)) {
        const amount = Number(m[1]);
        const unit = m[2].toLowerCase();
        const windowHours = unit.startsWith("hour") ? amount : amount * 24;
        if (hoursSince > windowHours) exceeded.push(`${amount} ${unit} (${chunk.title})`);
      }
    }
    if (exceeded.length > 0) {
      const promises = containsPromise(reply);
      const days = Math.floor(hoursSince / 24);
      flags.push({
        code: "POLICY_WINDOW_EXCEEDED",
        severity: promises ? "critical" : "warning",
        message:
          `The order was delivered ${days} days ago, but the retrieved policy mentions a window of ${[...new Set(exceeded)].join(", ")}. ` +
          (promises
            ? "The draft still appears to promise an outcome. Do not send as is."
            : "Make sure the draft does not promise a refund, return or replacement."),
      });
    }
  }

  if (containsPromise(reply) && (assessment.confidence !== "high" || !assessment.grounded || retrievalStatus !== "found")) {
    flags.push({
      code: "OVERPROMISE_RISK",
      severity: "warning",
      message: "The draft commits to an outcome while confidence or grounding is not high. Soften it or verify before sending.",
    });
  }

  if (/(\*\*|^#{1,3}\s|^[-*]\s|\[[A-Z][A-Za-z ]+\]|\{\{|<[a-z_]+>)/m.test(reply)) {
    flags.push({
      code: "FORMATTING",
      severity: "info",
      message: "The draft contains markdown or placeholder text; tidy it before sending.",
    });
  }

  return flags;
}

export function worstSeverity(flags: GuardrailFlag[]): GuardrailFlag["severity"] | null {
  if (flags.some((f) => f.severity === "critical")) return "critical";
  if (flags.some((f) => f.severity === "warning")) return "warning";
  if (flags.length > 0) return "info";
  return null;
}
