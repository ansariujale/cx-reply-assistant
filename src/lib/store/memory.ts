import type {
  AiGeneration,
  Brand,
  Conversation,
  ConversationDetail,
  ConversationSummary,
  Customer,
  GenerationInput,
  KbEntry,
  KbEntryInput,
  Message,
  MessageInput,
  Order,
} from "@/lib/domain/types";
import { newId } from "@/lib/ids";
import { buildSeed, type SeedData } from "@/lib/seed/data";
import type { Store } from "./types";

const clone = <T>(value: T): T => structuredClone(value);

export interface MemoryStoreOptions {
  /** Injectable clock so tests can pin time. */
  now?: () => Date;
}

/**
 * Zero-dependency adapter used for local development and tests.
 * State lives in process memory: it resets on restart and is per instance,
 * which is why deployments must use the Postgres adapter.
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  private readonly now: () => Date;
  private brands: Brand[];
  private kbEntries: KbEntry[];
  private customers: Customer[];
  private orders: Order[];
  private conversations: Conversation[];
  private messages: Message[];
  private generations: AiGeneration[] = [];

  constructor(seed: SeedData = buildSeed(), options: MemoryStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.brands = clone(seed.brands);
    this.kbEntries = clone(seed.kbEntries);
    this.customers = clone(seed.customers);
    this.orders = clone(seed.orders);
    this.conversations = clone(seed.conversations);
    this.messages = clone(seed.messages);
  }

  private ts(): string {
    return this.now().toISOString();
  }

  async listBrands(): Promise<Brand[]> {
    return clone(this.brands);
  }

  async getBrand(id: string): Promise<Brand | null> {
    return clone(this.brands.find((b) => b.id === id) ?? null);
  }

  async listKbEntries(brandId: string): Promise<KbEntry[]> {
    return clone(
      this.kbEntries
        .filter((e) => e.brandId === brandId)
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    );
  }

  async getKbEntry(id: string): Promise<KbEntry | null> {
    return clone(this.kbEntries.find((e) => e.id === id) ?? null);
  }

  async createKbEntry(input: KbEntryInput): Promise<KbEntry> {
    const now = this.ts();
    const entry: KbEntry = { id: newId("kb"), ...input, createdAt: now, updatedAt: now };
    this.kbEntries.push(entry);
    return clone(entry);
  }

  async updateKbEntry(id: string, patch: Partial<Omit<KbEntryInput, "brandId">>): Promise<KbEntry | null> {
    const entry = this.kbEntries.find((e) => e.id === id);
    if (!entry) return null;
    Object.assign(entry, patch, { updatedAt: this.ts() });
    return clone(entry);
  }

  async deleteKbEntry(id: string): Promise<boolean> {
    const before = this.kbEntries.length;
    this.kbEntries = this.kbEntries.filter((e) => e.id !== id);
    return this.kbEntries.length < before;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const summaries = this.conversations.map((c) => {
      const msgs = this.messages
        .filter((m) => m.conversationId === c.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        ...c,
        brand: this.brands.find((b) => b.id === c.brandId)!,
        customer: this.customers.find((cu) => cu.id === c.customerId)!,
        lastMessage: msgs.at(-1) ?? null,
        messageCount: msgs.length,
      };
    });
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return clone(summaries);
  }

  async getConversation(id: string): Promise<ConversationDetail | null> {
    const c = this.conversations.find((x) => x.id === id);
    if (!c) return null;
    return clone({
      ...c,
      brand: this.brands.find((b) => b.id === c.brandId)!,
      customer: this.customers.find((cu) => cu.id === c.customerId)!,
      order: this.orders.find((o) => o.id === c.orderId) ?? null,
      messages: this.messages
        .filter((m) => m.conversationId === id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    });
  }

  async addMessage(input: MessageInput): Promise<Message> {
    const conv = this.conversations.find((c) => c.id === input.conversationId);
    if (!conv) throw new Error(`Conversation ${input.conversationId} not found`);
    const now = this.ts();
    const message: Message = {
      id: newId("msg"),
      conversationId: input.conversationId,
      sender: input.sender,
      body: input.body,
      source: input.source,
      generationId: input.generationId ?? null,
      createdAt: now,
    };
    this.messages.push(message);
    conv.updatedAt = now;
    return clone(message);
  }

  async createGeneration(input: GenerationInput): Promise<AiGeneration> {
    const generation: AiGeneration = {
      ...input,
      id: newId("gen"),
      status: "draft",
      agentEditedResponse: null,
      finalResponse: null,
      createdAt: this.ts(),
      resolvedAt: null,
    };
    this.generations.push(generation);
    return clone(generation);
  }

  async getGeneration(id: string): Promise<AiGeneration | null> {
    return clone(this.generations.find((g) => g.id === id) ?? null);
  }

  async listGenerations(opts: { conversationId?: string; limit?: number } = {}): Promise<AiGeneration[]> {
    let list = this.generations;
    if (opts.conversationId) list = list.filter((g) => g.conversationId === opts.conversationId);
    // Newest first; insertion order breaks ties so same-millisecond rows stay deterministic.
    list = list
      .map((g, i) => ({ g, i }))
      .sort((a, b) => b.g.createdAt.localeCompare(a.g.createdAt) || b.i - a.i)
      .map((x) => x.g);
    if (opts.limit) list = list.slice(0, opts.limit);
    return clone(list);
  }

  async supersedeDrafts(conversationId: string): Promise<number> {
    let count = 0;
    const now = this.ts();
    for (const g of this.generations) {
      if (g.conversationId === conversationId && g.status === "draft") {
        g.status = "superseded";
        g.resolvedAt = now;
        count++;
      }
    }
    return count;
  }

  async approveGeneration(id: string, finalResponse: string) {
    const g = this.generations.find((x) => x.id === id);
    if (!g || g.status !== "draft") return null;
    const edited = finalResponse.trim() !== g.aiResponse.trim();
    g.agentEditedResponse = edited ? finalResponse : null;
    g.finalResponse = finalResponse;
    g.status = "approved";
    g.resolvedAt = this.ts();
    const message = await this.addMessage({
      conversationId: g.conversationId,
      sender: "agent",
      body: finalResponse,
      source: edited ? "ai_edited" : "ai_approved",
      generationId: g.id,
    });
    return { generation: clone(g), message };
  }

  async discardGeneration(id: string): Promise<AiGeneration | null> {
    const g = this.generations.find((x) => x.id === id);
    if (!g || g.status !== "draft") return null;
    g.status = "discarded";
    g.resolvedAt = this.ts();
    return clone(g);
  }
}
