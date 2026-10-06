import type {
  AiGeneration,
  Brand,
  ConversationDetail,
  ConversationSummary,
  GenerationInput,
  KbEntry,
  KbEntryInput,
  Message,
  MessageInput,
} from "@/lib/domain/types";

/**
 * Persistence port. The AI pipeline, API routes and pages depend only on this
 * interface; `memory.ts` and `postgres.ts` are interchangeable adapters.
 */
export interface Store {
  readonly kind: "memory" | "postgres";

  listBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | null>;

  /** Always scoped by brand. There is deliberately no "list all entries" method. */
  listKbEntries(brandId: string): Promise<KbEntry[]>;
  getKbEntry(id: string): Promise<KbEntry | null>;
  createKbEntry(input: KbEntryInput): Promise<KbEntry>;
  updateKbEntry(id: string, patch: Partial<Omit<KbEntryInput, "brandId">>): Promise<KbEntry | null>;
  deleteKbEntry(id: string): Promise<boolean>;

  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationDetail | null>;
  addMessage(input: MessageInput): Promise<Message>;

  createGeneration(input: GenerationInput): Promise<AiGeneration>;
  getGeneration(id: string): Promise<AiGeneration | null>;
  listGenerations(opts?: { conversationId?: string; limit?: number }): Promise<AiGeneration[]>;
  /** Marks open drafts for a conversation as superseded (called before a regenerate). */
  supersedeDrafts(conversationId: string): Promise<number>;
  /** Atomically records the final text and posts it as an agent message. */
  approveGeneration(
    id: string,
    finalResponse: string,
  ): Promise<{ generation: AiGeneration; message: Message } | null>;
  discardGeneration(id: string): Promise<AiGeneration | null>;
}
