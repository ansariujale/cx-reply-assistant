import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateReply } from "@/lib/ai/generateReply";
import { MockLlmClient } from "@/lib/ai/llm";
import { buildSeed } from "@/lib/seed/data";
import { createSql, PostgresStore } from "@/lib/store/postgres";
import { seedPostgres } from "@/lib/store/postgres-seed";

/**
 * Runs the real Postgres adapter against an embedded Postgres (PGlite) over the
 * wire protocol, so the SQL, jsonb round-trips and transactions are exercised
 * exactly as they will be on Supabase, with no Docker or external database.
 */

// Pinned one hour in the past: the database stamps new rows with its own now(),
// so seeded timestamps must precede anything the tests create.
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000 - 60 * 60 * 1000);
let server: PGLiteSocketServer;
let sql: Sql;
let store: PostgresStore;

beforeAll(async () => {
  const db = await PGlite.create();
  const port = 54_300 + Math.floor(Math.random() * 500);
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 5 });
  await server.start();

  sql = createSql(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
  const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "0001_init.sql"), "utf8");
  await sql.unsafe(migration);
  await seedPostgres(sql, buildSeed(NOW));
  store = new PostgresStore(sql);
}, 90_000);

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await server?.stop();
});

describe("PostgresStore (embedded Postgres)", () => {
  it("lists brands and keeps knowledge scoped per brand", async () => {
    const brands = await store.listBrands();
    expect(brands.map((b) => b.id).sort()).toEqual(["brand_glowco", "brand_peakfuel"]);

    const glow = await store.listKbEntries("brand_glowco");
    const peak = await store.listKbEntries("brand_peakfuel");
    expect(glow).toHaveLength(5);
    expect(peak).toHaveLength(5);
    expect(glow.every((e) => e.brandId === "brand_glowco" && e.id.startsWith("kb_glow_"))).toBe(true);
    expect(peak.every((e) => e.brandId === "brand_peakfuel" && e.id.startsWith("kb_peak_"))).toBe(true);
    expect(glow.find((e) => e.id === "kb_glow_refunds")?.tags).toContain("30 days");
  });

  it("creates, updates and deletes knowledge entries with jsonb tags intact", async () => {
    const created = await store.createKbEntry({
      brandId: "brand_glowco",
      category: "general",
      title: "Loyalty points",
      content: "Customers earn 1 point per Rs 100 spent. Points expire after 12 months.",
      tags: ["loyalty", "points"],
    });
    expect(created.id).toMatch(/^kb_/);
    expect(created.tags).toEqual(["loyalty", "points"]);

    const updated = await store.updateKbEntry(created.id, { content: "Points expire after 24 months.", tags: ["loyalty"] });
    expect(updated?.content).toBe("Points expire after 24 months.");
    expect(updated?.tags).toEqual(["loyalty"]);
    expect(updated?.title).toBe("Loyalty points");
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.createdAt).getTime());

    expect((await store.listKbEntries("brand_glowco")).some((e) => e.id === created.id)).toBe(true);
    expect((await store.listKbEntries("brand_peakfuel")).some((e) => e.id === created.id)).toBe(false);

    expect(await store.deleteKbEntry(created.id)).toBe(true);
    expect(await store.deleteKbEntry(created.id)).toBe(false);
    expect(await store.getKbEntry(created.id)).toBeNull();
  });

  it("lists conversations with brand, customer, last message and counts", async () => {
    const list = await store.listConversations();
    expect(list).toHaveLength(4);
    const broken = list.find((c) => c.id === "conv_glow_broken_bottle")!;
    expect(broken.brand.name).toBe("Glow & Co.");
    expect(broken.customer.name).toBe("Priya Sharma");
    expect(broken.messageCount).toBe(3);
    expect(broken.lastMessage?.body).toMatch(/bottle is broken/);
    expect(typeof broken.updatedAt).toBe("string");
  });

  it("loads conversation detail with order facts and ordered messages", async () => {
    const detail = await store.getConversation("conv_peak_late_refund");
    expect(detail?.order?.orderNumber).toBe("PF-7731");
    expect(detail?.order?.items[0]?.name).toMatch(/Whey/);
    expect(detail?.order?.total).toBe(2499);
    expect(detail?.order?.deliveredAt).toBe(new Date(NOW.getTime() - (20 * 24 + 2) * 3_600_000).toISOString());
    expect(detail?.messages.map((m) => m.sender)).toEqual(["customer"]);
    expect(await store.getConversation("nope")).toBeNull();
  });

  it("appends messages and bumps the conversation timestamp", async () => {
    const before = (await store.getConversation("conv_glow_tracking"))!;
    const msg = await store.addMessage({ conversationId: "conv_glow_tracking", sender: "agent", body: "Looking into it now.", source: "human" });
    expect(msg.id).toMatch(/^msg_/);
    const after = (await store.getConversation("conv_glow_tracking"))!;
    expect(after.messages.at(-1)?.id).toBe(msg.id);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
    await expect(store.addMessage({ conversationId: "missing", sender: "agent", body: "x", source: "human" })).rejects.toThrow(/not found/);
  });

  it("runs the AI pipeline end to end and round-trips the generation through jsonb", async () => {
    const deps = { store, llm: new MockLlmClient(), now: () => NOW };
    const g = await generateReply(deps, { conversationId: "conv_glow_broken_bottle" });
    expect(g.status).toBe("draft");
    expect(g.retrievedContext[0]?.entryId).toBe("kb_glow_damaged");

    const loaded = await store.getGeneration(g.id);
    expect(loaded).toEqual(g);

    const second = await generateReply(deps, { conversationId: "conv_glow_broken_bottle", agentInstruction: "shorter" });
    expect((await store.getGeneration(g.id))?.status).toBe("superseded");
    const list = await store.listGenerations({ conversationId: "conv_glow_broken_bottle" });
    expect(list.map((x) => x.id)).toEqual([second.id, g.id]);
    expect(list[0].agentInstruction).toBe("shorter");

    const edited = `${second.aiResponse} A replacement is on its way.`;
    const approved = await store.approveGeneration(second.id, edited);
    expect(approved?.generation.status).toBe("approved");
    expect(approved?.generation.agentEditedResponse).toBe(edited);
    expect(approved?.generation.finalResponse).toBe(edited);
    expect(approved?.message.source).toBe("ai_edited");
    expect(approved?.message.generationId).toBe(second.id);
    expect(await store.approveGeneration(second.id, edited)).toBeNull();

    const conv = await store.getConversation("conv_glow_broken_bottle");
    expect(conv?.messages.at(-1)?.body).toBe(edited);

    const third = await generateReply(deps, { conversationId: "conv_peak_gift_wrap" });
    expect(third.retrievalStatus).toBe("none");
    expect(third.flags.map((f) => f.code)).toContain("NO_KNOWLEDGE");
    expect((await store.discardGeneration(third.id))?.status).toBe("discarded");
    expect(await store.discardGeneration(third.id)).toBeNull();

    const all = await store.listGenerations({ limit: 10 });
    expect(all.map((x) => x.id)).toEqual([third.id, second.id, g.id]);
  });
});
