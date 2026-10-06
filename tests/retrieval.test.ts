import { describe, expect, it } from "vitest";
import { retrieve } from "@/lib/retrieval/retrieve";
import { stem, tokenize } from "@/lib/retrieval/tokenize";
import { buildSeed } from "@/lib/seed/data";

const seed = buildSeed(new Date("2026-10-06T10:00:00Z"));
const glowEntries = seed.kbEntries.filter((e) => e.brandId === "brand_glowco");
const peakEntries = seed.kbEntries.filter((e) => e.brandId === "brand_peakfuel");

describe("tokenizer", () => {
  it("maps common inflections onto one stem", () => {
    expect(new Set(["refund", "refunds", "refunded", "refunding"].map(stem)).size).toBe(1);
    expect(new Set(["ship", "shipping", "shipped"].map(stem)).size).toBe(1);
    expect(new Set(["deliver", "delivery", "delivered"].map(stem)).size).toBe(1);
    expect(new Set(["damage", "damaged"].map(stem)).size).toBe(1);
    expect(new Set(["cancel", "cancelled", "cancellation"].map(stem)).size).toBe(1);
  });

  it("drops stopwords and punctuation", () => {
    expect(tokenize("Can I get a refund?")).toEqual(["refund"]);
  });
});

describe("retrieve (brand-scoped BM25)", () => {
  it("finds the damaged-items policy for the broken bottle scenario", () => {
    const r = retrieve("My order was delivered but the bottle is broken. What can I do?", glowEntries);
    expect(r.status).toBe("found");
    expect(r.chunks[0]?.entryId).toBe("kb_glow_damaged");
    expect(r.chunks.every((c) => c.entryId.startsWith("kb_glow_"))).toBe(true);
  });

  it("finds the refund policy for a late refund request", () => {
    const r = retrieve("I received this 20 days ago. Can I get a refund? I didn't like the taste at all.", peakEntries);
    expect(r.status).toBe("found");
    expect(r.chunks[0]?.entryId).toBe("kb_peak_refunds");
  });

  it("finds the shipping policy for a tracking question", () => {
    const r = retrieve(
      "It has been 4 days since my order shipped and the tracking page has not updated at all. Where is my order?",
      glowEntries,
    );
    expect(r.status).toBe("found");
    expect(r.chunks[0]?.entryId).toBe("kb_glow_shipping");
  });

  it("reports no knowledge for an uncovered question instead of guessing", () => {
    const r = retrieve("Do you offer gift wrapping? I want to send a second order as a Diwali gift to my brother.", peakEntries);
    expect(r.status).toBe("none");
    expect(r.chunks).toHaveLength(0);
  });

  it("returns nothing for empty or stopword-only queries", () => {
    expect(retrieve("", glowEntries).status).toBe("none");
    expect(retrieve("hi there, thanks!", glowEntries).status).toBe("none");
    expect(retrieve("refund please", []).status).toBe("none");
  });

  it("never surfaces another brand's knowledge, even for that brand's vocabulary", () => {
    // "store credit" and "tampered" are Peak Fuel concepts; Glow & Co. must not leak them in.
    const r = retrieve("Will I get store credit if the seal was tampered?", glowEntries);
    for (const chunk of r.chunks) {
      expect(chunk.entryId.startsWith("kb_glow_")).toBe(true);
      expect(chunk.content).not.toMatch(/Peak Fuel/);
    }
    const peakSide = retrieve("The bottle arrived cracked and leaking", peakEntries);
    for (const chunk of peakSide.chunks) {
      expect(chunk.entryId.startsWith("kb_peak_")).toBe(true);
      expect(chunk.content).not.toMatch(/Glow/);
    }
  });

  it("explains matches with the terms that hit", () => {
    const r = retrieve("Can I cancel my order?", peakEntries);
    expect(r.chunks[0]?.entryId).toBe("kb_peak_cancellations");
    expect(r.chunks[0]?.matchedTerms).toContain("cancel");
  });
});
