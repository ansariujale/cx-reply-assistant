import { describe, expect, it } from "vitest";
import { describeOrder } from "@/lib/ai/prompt";
import { containsPromise, extractNumbers, runGuardrails, type GuardrailContext } from "@/lib/ai/guardrails";
import type { AiAssessment, Order, RetrievedChunk } from "@/lib/domain/types";

const now = new Date("2026-10-06T10:00:00Z");

const refundChunk: RetrievedChunk = {
  entryId: "kb_peak_refunds",
  title: "Refund policy",
  category: "refunds",
  content:
    "Refunds are only permitted within 7 days of delivery. By default refunds are issued as store credit within 48 hours of the return being received.",
  score: 5,
  matchedTerms: ["refund"],
};

const order = (daysAgo: number): Order => ({
  id: "o1",
  brandId: "brand_peakfuel",
  customerId: "c1",
  orderNumber: "PF-1",
  status: "delivered",
  items: [{ name: "Whey", quantity: 1, unitPrice: 2499 }],
  total: 2499,
  currency: "INR",
  orderedAt: new Date(now.getTime() - (daysAgo + 4) * 86_400_000).toISOString(),
  shippedAt: null,
  deliveredAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
});

const confident: AiAssessment = {
  confidence: "high",
  grounded: true,
  usedEntryIds: ["kb_peak_refunds"],
  missingInformation: [],
  needsHumanReview: false,
  rationale: "",
};

function ctx(overrides: Partial<GuardrailContext>): GuardrailContext {
  const o = overrides.order === undefined ? order(20) : overrides.order;
  return {
    reply: "",
    assessment: confident,
    retrievalStatus: "found",
    chunks: [refundChunk],
    orderFacts: describeOrder(o, now),
    order: o,
    customerMessage: "I received this 20 days ago. Can I get a refund?",
    now,
    ...overrides,
  };
}

const codes = (flags: { code: string }[]) => flags.map((f) => f.code);

describe("guardrails", () => {
  it("extracts numbers robustly", () => {
    expect([...extractNumbers("within 7 days, Rs 1,499 and 48 hours")]).toEqual(["7", "1499", "48"]);
  });

  it("stays quiet for a careful, grounded reply inside policy", () => {
    const flags = runGuardrails(
      ctx({
        order: order(2),
        reply:
          "Thanks for letting us know. Our policy allows refunds within 7 days of delivery, so you are within the window. The team will confirm the next steps shortly.",
      }),
    );
    expect(flags).toHaveLength(0);
  });

  it("flags a promised refund when the delivery window has passed", () => {
    const flags = runGuardrails(
      ctx({ reply: "No problem! We will process your full refund to your original payment method right away." }),
    );
    const window = flags.find((f) => f.code === "POLICY_WINDOW_EXCEEDED");
    expect(window?.severity).toBe("critical");
    expect(window?.message).toMatch(/20 days ago/);
    expect(window?.message).toMatch(/7 days/);
  });

  it("downgrades the window flag to a warning when the reply does not promise anything", () => {
    const flags = runGuardrails(
      ctx({
        reply:
          "I understand, and I am sorry the taste was not right. Refunds are only permitted within 7 days of delivery, and this order was delivered 20 days ago, so I am not able to promise a refund. I will ask the team to review and confirm.",
      }),
    );
    expect(flags.find((f) => f.code === "POLICY_WINDOW_EXCEEDED")?.severity).toBe("warning");
    expect(codes(flags)).not.toContain("UNSUPPORTED_NUMBERS");
  });

  it("treats a negated statement as a refusal, not a promise", () => {
    const flags = runGuardrails(
      ctx({
        reply:
          "Hi Rahul, thanks for reaching out. Our refund policy allows refunds within 7 days of delivery. Since your order was delivered 20 days ago, it is no longer eligible for a refund. We appreciate your understanding.",
      }),
    );
    expect(flags.find((f) => f.code === "POLICY_WINDOW_EXCEEDED")?.severity).toBe("warning");
    expect(codes(flags)).not.toContain("OVERPROMISE_RISK");
    expect(containsPromise("We cannot refund this order. However, we will issue a replacement today.")).toBe(true);
    expect(containsPromise("Unfortunately you are not entitled to a full refund at this stage.")).toBe(false);
  });

  it("flags figures that appear nowhere in the retrieved knowledge or order facts", () => {
    const flags = runGuardrails(ctx({ order: order(2), reply: "You can return it within 14 days for a refund of Rs 2,000." }));
    const f = flags.find((x) => x.code === "UNSUPPORTED_NUMBERS");
    expect(f).toBeDefined();
    expect(f?.message).toMatch(/14/);
    expect(f?.message).toMatch(/2000/);
  });

  it("marks the no-knowledge path as critical", () => {
    const flags = runGuardrails(
      ctx({
        retrievalStatus: "none",
        chunks: [],
        assessment: { ...confident, grounded: false, confidence: "low", needsHumanReview: true },
        reply: "Thanks for reaching out. I am checking with our team and will get back to you shortly.",
      }),
    );
    expect(codes(flags)).toEqual(expect.arrayContaining(["NO_KNOWLEDGE", "UNGROUNDED", "LOW_CONFIDENCE", "NEEDS_REVIEW"]));
    expect(flags.some((f) => f.severity === "critical")).toBe(true);
  });

  it("flags commitments made without high confidence", () => {
    const flags = runGuardrails(
      ctx({
        order: order(2),
        assessment: { ...confident, confidence: "medium" },
        reply: "We will issue a replacement within 7 days.",
      }),
    );
    expect(codes(flags)).toContain("OVERPROMISE_RISK");
  });

  it("surfaces provider failures and malformed output", () => {
    const flags = runGuardrails(ctx({ llmFailed: "timeout", reply: "holding reply" }));
    expect(codes(flags)).toContain("LLM_UNAVAILABLE");
    const malformed = runGuardrails(ctx({ parseFailed: true, reply: "some text" }));
    expect(codes(malformed)).toContain("MALFORMED_OUTPUT");
  });
});
