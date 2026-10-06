import { describe, expect, it } from "vitest";
import { generateReply, holdingReply } from "@/lib/ai/generateReply";
import { LlmError, MockLlmClient, type LlmClient, type LlmRequest, type LlmResponse } from "@/lib/ai/llm";
import { MemoryStore } from "@/lib/store/memory";
import { buildSeed } from "@/lib/seed/data";

const NOW = new Date("2026-10-06T10:00:00Z");

/** Monotonic clock pinned to NOW so ordering is deterministic regardless of wall time. */
function makeClock(start: Date) {
  let t = start.getTime();
  return () => new Date((t += 1000));
}

function deps() {
  const clock = makeClock(NOW);
  return { store: new MemoryStore(buildSeed(NOW), { now: clock }), llm: new MockLlmClient(), now: () => NOW };
}

/** Test double that returns scripted outputs (or throws) in order. */
class ScriptedLlm implements LlmClient {
  readonly provider = "scripted";
  readonly model = "scripted-v1";
  calls: LlmRequest[] = [];
  constructor(private readonly outputs: Array<string | Error>) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    const next = this.outputs.shift();
    if (next === undefined) throw new Error("no scripted output left");
    if (next instanceof Error) throw next;
    return { text: next, model: this.model, promptTokens: 10, completionTokens: 5 };
  }
}

const structured = (overrides: Record<string, unknown>) =>
  JSON.stringify({
    reply: "ok",
    confidence: "high",
    grounded: true,
    used_entry_ids: [],
    missing_information: [],
    needs_human_review: false,
    rationale: "",
    ...overrides,
  });

describe("generateReply pipeline", () => {
  it("produces a grounded draft from brand-scoped knowledge for the broken bottle scenario", async () => {
    const g = await generateReply(deps(), { conversationId: "conv_glow_broken_bottle" });

    expect(g.status).toBe("draft");
    expect(g.brandId).toBe("brand_glowco");
    expect(g.customerMessage).toBe("My order was delivered but the bottle is broken. What can I do?");
    expect(g.retrievalStatus).toBe("found");
    expect(g.retrievedContext[0]?.entryId).toBe("kb_glow_damaged");
    expect(g.retrievedContext.every((c) => c.entryId.startsWith("kb_glow_"))).toBe(true);
    expect(g.provider).toBe("mock");
    expect(g.aiResponse).toMatch(/Priya/);
    expect(g.flags.some((f) => f.severity === "critical")).toBe(false);
    expect(g.assessment.usedEntryIds).toEqual(["kb_glow_damaged"]);
  });

  it("never uses Glow knowledge for a Peak Fuel customer", async () => {
    const g = await generateReply(deps(), { conversationId: "conv_peak_late_refund" });
    expect(g.brandId).toBe("brand_peakfuel");
    expect(g.retrievedContext.length).toBeGreaterThan(0);
    for (const chunk of g.retrievedContext) {
      expect(chunk.entryId.startsWith("kb_peak_")).toBe(true);
      expect(chunk.content).not.toMatch(/30 days/);
    }
    expect(g.retrievedContext[0]?.entryId).toBe("kb_peak_refunds");
  });

  it("gives the model deterministic order facts so it can judge policy windows", async () => {
    const llm = new ScriptedLlm([
      structured({
        reply:
          "I am sorry about the taste. Refunds are only permitted within 7 days of delivery and this order was delivered 20 days ago, so I cannot promise a refund, but I will ask the team to review.",
        used_entry_ids: ["kb_peak_refunds"],
        needs_human_review: true,
        rationale: "Outside refund window.",
      }),
    ]);
    const g = await generateReply({ ...deps(), llm }, { conversationId: "conv_peak_late_refund" });

    expect(llm.calls[0].user).toMatch(/Delivered on 2026-09-16 \(20 days ago\)/);
    expect(llm.calls[0].user).toMatch(/\[kb_peak_refunds\]/);
    expect(llm.calls[0].user).not.toMatch(/kb_glow/);
    expect(llm.calls[0].system).toMatch(/Peak Fuel/);
    expect(g.flags.find((f) => f.code === "POLICY_WINDOW_EXCEEDED")?.severity).toBe("warning");
  });

  it("escalates to critical when the model promises a refund outside the window", async () => {
    const llm = new ScriptedLlm([
      structured({ reply: "Of course! We will process your full refund right away.", used_entry_ids: ["kb_peak_refunds"] }),
    ]);
    const g = await generateReply({ ...deps(), llm }, { conversationId: "conv_peak_late_refund" });
    expect(g.flags.find((f) => f.code === "POLICY_WINDOW_EXCEEDED")?.severity).toBe("critical");
  });

  it("falls back to a holding reply when the knowledge base has nothing relevant", async () => {
    const g = await generateReply(deps(), { conversationId: "conv_peak_gift_wrap" });
    expect(g.retrievalStatus).toBe("none");
    expect(g.retrievedContext).toHaveLength(0);
    expect(g.assessment.grounded).toBe(false);
    expect(g.assessment.needsHumanReview).toBe(true);
    expect(g.flags.map((f) => f.code)).toContain("NO_KNOWLEDGE");
  });

  it("overrides a model that claims grounding without any knowledge", async () => {
    const llm = new ScriptedLlm([structured({ reply: "Yes, we offer free gift wrapping on all orders!" })]);
    const g = await generateReply({ ...deps(), llm }, { conversationId: "conv_peak_gift_wrap" });
    expect(g.aiResponse).toBe(holdingReply("Karan"));
    expect(g.flags.map((f) => f.code)).toEqual(expect.arrayContaining(["MODEL_OVERRIDDEN", "NO_KNOWLEDGE"]));
    expect(g.assessment.confidence).toBe("low");
  });

  it("repairs malformed JSON once and flags it if the model still fails", async () => {
    const llm = new ScriptedLlm(["Sure! Here is the reply: Hi Priya...", "still not json"]);
    const g = await generateReply({ ...deps(), llm }, { conversationId: "conv_glow_broken_bottle" });
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].user).toMatch(/not valid JSON/);
    expect(g.flags.map((f) => f.code)).toContain("MALFORMED_OUTPUT");
    expect(g.assessment.needsHumanReview).toBe(true);
  });

  it("still records a generation with a holding reply when the provider fails", async () => {
    const llm = new ScriptedLlm([new LlmError("OpenRouter responded 503", 503, true)]);
    const d = { ...deps(), llm };
    const g = await generateReply(d, { conversationId: "conv_glow_broken_bottle" });
    expect(g.aiResponse).toBe(holdingReply("Priya"));
    expect(g.flags.find((f) => f.code === "LLM_UNAVAILABLE")?.severity).toBe("critical");
    expect(await d.store.getGeneration(g.id)).not.toBeNull();
  });

  it("refuses to generate when the customer has not said anything yet", async () => {
    const store = new MemoryStore({ ...buildSeed(NOW), messages: [] }, { now: makeClock(NOW) });
    await expect(
      generateReply({ store, llm: new MockLlmClient(), now: () => NOW }, { conversationId: "conv_glow_tracking" }),
    ).rejects.toThrow(/no customer message/i);
    await expect(
      generateReply({ store, llm: new MockLlmClient(), now: () => NOW }, { conversationId: "does_not_exist" }),
    ).rejects.toThrow(/not found/i);
  });

  it("supersedes the previous draft on regenerate and records approvals with edits", async () => {
    const d = deps();
    const first = await generateReply(d, { conversationId: "conv_glow_broken_bottle" });
    const second = await generateReply(d, { conversationId: "conv_glow_broken_bottle", agentInstruction: "shorter" });
    expect((await d.store.getGeneration(first.id))?.status).toBe("superseded");
    expect(second.agentInstruction).toBe("shorter");

    const edited = `${second.aiResponse} Also, a replacement is on its way.`;
    const approved = await d.store.approveGeneration(second.id, edited);
    expect(approved?.generation.status).toBe("approved");
    expect(approved?.generation.agentEditedResponse).toBe(edited);
    expect(approved?.generation.finalResponse).toBe(edited);
    expect(approved?.message.source).toBe("ai_edited");
    expect(approved?.message.generationId).toBe(second.id);

    const conv = await d.store.getConversation("conv_glow_broken_bottle");
    expect(conv?.messages.at(-1)?.body).toBe(edited);
    expect(conv?.messages.at(-1)?.sender).toBe("agent");

    // A second approval of the same draft is rejected.
    expect(await d.store.approveGeneration(second.id, edited)).toBeNull();
  });

  it("records unedited approvals as ai_approved", async () => {
    const d = deps();
    const g = await generateReply(d, { conversationId: "conv_glow_tracking" });
    const approved = await d.store.approveGeneration(g.id, g.aiResponse);
    expect(approved?.message.source).toBe("ai_approved");
    expect(approved?.generation.agentEditedResponse).toBeNull();
  });

  it("uses the previous customer message for context when the follow-up is very short", async () => {
    const llm = new ScriptedLlm([structured({ reply: "ok", confidence: "medium" })]);
    const d = { ...deps(), llm };
    await d.store.addMessage({ conversationId: "conv_glow_broken_bottle", sender: "customer", body: "Yes please", source: "human" });
    const g = await generateReply(d, { conversationId: "conv_glow_broken_bottle" });
    expect(g.retrievalQuery).toMatch(/bottle is broken/);
    expect(g.retrievedContext[0]?.entryId).toBe("kb_glow_damaged");
  });
});
