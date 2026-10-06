import postgres, { type Sql } from "postgres";
import type {
  AiGeneration,
  Brand,
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
import type { Store } from "./types";

/* ---------- connection ---------- */

export function createSql(url: string): Sql {
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const sslOff = process.env.DATABASE_SSL === "false";
  return postgres(url, {
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    ssl: isLocal || sslOff ? false : "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

/**
 * postgres.js types jsonb parameters as JSONValue; our domain types are plain
 * data, so the cast is safe. Accepts both a connection and a transaction handle.
 */
export function asJson(sql: Pick<Sql, "json">, value: unknown) {
  return sql.json(value as Parameters<Sql["json"]>[0]);
}

/* ---------- row mapping ---------- */

type Row = Record<string, unknown>;
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const json = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

const mapBrand = (r: Row): Brand => ({
  id: String(r.id),
  slug: String(r.slug),
  name: String(r.name),
  description: String(r.description ?? ""),
  tone: String(r.tone ?? ""),
  supportEmail: String(r.support_email ?? ""),
  accentColor: String(r.accent_color ?? "#334155"),
  createdAt: iso(r.created_at),
});

const mapKb = (r: Row): KbEntry => ({
  id: String(r.id),
  brandId: String(r.brand_id),
  category: r.category as KbEntry["category"],
  title: String(r.title),
  content: String(r.content),
  tags: json<string[]>(r.tags, []),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const mapCustomer = (r: Row): Customer => ({
  id: String(r.id),
  brandId: String(r.brand_id),
  name: String(r.name),
  email: String(r.email ?? ""),
  phone: String(r.phone ?? ""),
});

const mapOrder = (r: Row): Order => ({
  id: String(r.id),
  brandId: String(r.brand_id),
  customerId: String(r.customer_id),
  orderNumber: String(r.order_number),
  status: r.status as Order["status"],
  items: json<Order["items"]>(r.items, []),
  total: num(r.total),
  currency: String(r.currency ?? "INR"),
  orderedAt: iso(r.ordered_at),
  shippedAt: isoOrNull(r.shipped_at),
  deliveredAt: isoOrNull(r.delivered_at),
});

const mapMessage = (r: Row): Message => ({
  id: String(r.id),
  conversationId: String(r.conversation_id),
  sender: r.sender as Message["sender"],
  body: String(r.body),
  source: r.source as Message["source"],
  generationId: r.generation_id == null ? null : String(r.generation_id),
  createdAt: iso(r.created_at),
});

const mapGeneration = (r: Row): AiGeneration => ({
  id: String(r.id),
  conversationId: String(r.conversation_id),
  brandId: String(r.brand_id),
  customerMessageId: r.customer_message_id == null ? null : String(r.customer_message_id),
  customerMessage: String(r.customer_message),
  retrievalQuery: String(r.retrieval_query ?? ""),
  retrievalStatus: r.retrieval_status as AiGeneration["retrievalStatus"],
  retrievedContext: json<AiGeneration["retrievedContext"]>(r.retrieved_context, []),
  provider: String(r.provider),
  model: String(r.model),
  promptTokens: numOrNull(r.prompt_tokens),
  completionTokens: numOrNull(r.completion_tokens),
  latencyMs: num(r.latency_ms ?? 0),
  aiResponse: String(r.ai_response),
  assessment: json<AiGeneration["assessment"]>(r.assessment, {
    confidence: "low",
    grounded: false,
    usedEntryIds: [],
    missingInformation: [],
    needsHumanReview: true,
    rationale: "",
  }),
  flags: json<AiGeneration["flags"]>(r.flags, []),
  agentInstruction: r.agent_instruction == null ? null : String(r.agent_instruction),
  agentEditedResponse: r.agent_edited_response == null ? null : String(r.agent_edited_response),
  finalResponse: r.final_response == null ? null : String(r.final_response),
  status: r.status as AiGeneration["status"],
  createdAt: iso(r.created_at),
  resolvedAt: isoOrNull(r.resolved_at),
});

/* ---------- adapter ---------- */

export class PostgresStore implements Store {
  readonly kind = "postgres" as const;

  constructor(private readonly sql: Sql) {}

  static fromUrl(url: string): PostgresStore {
    return new PostgresStore(createSql(url));
  }

  async listBrands(): Promise<Brand[]> {
    const rows = await this.sql`select * from brands order by name`;
    return rows.map(mapBrand);
  }

  async getBrand(id: string): Promise<Brand | null> {
    const [row] = await this.sql`select * from brands where id = ${id}`;
    return row ? mapBrand(row) : null;
  }

  async listKbEntries(brandId: string): Promise<KbEntry[]> {
    const rows = await this.sql`
      select * from kb_entries where brand_id = ${brandId} order by category, title`;
    return rows.map(mapKb);
  }

  async getKbEntry(id: string): Promise<KbEntry | null> {
    const [row] = await this.sql`select * from kb_entries where id = ${id}`;
    return row ? mapKb(row) : null;
  }

  async createKbEntry(input: KbEntryInput): Promise<KbEntry> {
    const id = newId("kb");
    const [row] = await this.sql`
      insert into kb_entries (id, brand_id, category, title, content, tags)
      values (${id}, ${input.brandId}, ${input.category}, ${input.title}, ${input.content}, ${asJson(this.sql,input.tags)})
      returning *`;
    return mapKb(row);
  }

  async updateKbEntry(id: string, patch: Partial<Omit<KbEntryInput, "brandId">>): Promise<KbEntry | null> {
    const [row] = await this.sql`
      update kb_entries set
        category   = coalesce(${patch.category ?? null}, category),
        title      = coalesce(${patch.title ?? null}, title),
        content    = coalesce(${patch.content ?? null}, content),
        tags       = coalesce(${patch.tags ? asJson(this.sql,patch.tags) : null}, tags),
        updated_at = now()
      where id = ${id}
      returning *`;
    return row ? mapKb(row) : null;
  }

  async deleteKbEntry(id: string): Promise<boolean> {
    const rows = await this.sql`delete from kb_entries where id = ${id} returning id`;
    return rows.length > 0;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const rows = await this.sql`
      select c.*,
             row_to_json(b)  as brand,
             row_to_json(cu) as customer,
             (select count(*)::int from messages m where m.conversation_id = c.id) as message_count,
             (select row_to_json(m) from messages m
                where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message
      from conversations c
      join brands b on b.id = c.brand_id
      join customers cu on cu.id = c.customer_id
      order by c.updated_at desc`;
    return rows.map((r) => ({
      id: String(r.id),
      brandId: String(r.brand_id),
      customerId: String(r.customer_id),
      orderId: r.order_id == null ? null : String(r.order_id),
      channel: r.channel as ConversationSummary["channel"],
      status: r.status as ConversationSummary["status"],
      subject: String(r.subject ?? ""),
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      brand: mapBrand(json<Row>(r.brand, {})),
      customer: mapCustomer(json<Row>(r.customer, {})),
      lastMessage: r.last_message ? mapMessage(json<Row>(r.last_message, {})) : null,
      messageCount: num(r.message_count),
    }));
  }

  async getConversation(id: string): Promise<ConversationDetail | null> {
    const [c] = await this.sql`select * from conversations where id = ${id}`;
    if (!c) return null;
    const [brandRow] = await this.sql`select * from brands where id = ${c.brand_id}`;
    const [customerRow] = await this.sql`select * from customers where id = ${c.customer_id}`;
    const orderRows = c.order_id ? await this.sql`select * from orders where id = ${c.order_id}` : [];
    const messageRows = await this.sql`
      select * from messages where conversation_id = ${id} order by created_at asc`;
    return {
      id: String(c.id),
      brandId: String(c.brand_id),
      customerId: String(c.customer_id),
      orderId: c.order_id == null ? null : String(c.order_id),
      channel: c.channel as ConversationDetail["channel"],
      status: c.status as ConversationDetail["status"],
      subject: String(c.subject ?? ""),
      createdAt: iso(c.created_at),
      updatedAt: iso(c.updated_at),
      brand: mapBrand(brandRow),
      customer: mapCustomer(customerRow),
      order: orderRows[0] ? mapOrder(orderRows[0]) : null,
      messages: messageRows.map(mapMessage),
    };
  }

  async addMessage(input: MessageInput): Promise<Message> {
    const result = await this.sql.begin(async (tx) => {
      const [conv] = await tx`select id from conversations where id = ${input.conversationId}`;
      if (!conv) throw new Error(`Conversation ${input.conversationId} not found`);
      const [row] = await tx`
        insert into messages (id, conversation_id, sender, body, source, generation_id)
        values (${newId("msg")}, ${input.conversationId}, ${input.sender}, ${input.body}, ${input.source}, ${input.generationId ?? null})
        returning *`;
      await tx`update conversations set updated_at = now() where id = ${input.conversationId}`;
      return mapMessage(row);
    });
    return result as Message;
  }

  async createGeneration(input: GenerationInput): Promise<AiGeneration> {
    const [row] = await this.sql`
      insert into ai_generations (
        id, conversation_id, brand_id, customer_message_id, customer_message, retrieval_query,
        retrieval_status, retrieved_context, provider, model, prompt_tokens, completion_tokens,
        latency_ms, ai_response, assessment, flags, agent_instruction, status
      ) values (
        ${newId("gen")}, ${input.conversationId}, ${input.brandId}, ${input.customerMessageId},
        ${input.customerMessage}, ${input.retrievalQuery}, ${input.retrievalStatus},
        ${asJson(this.sql,input.retrievedContext)}, ${input.provider}, ${input.model},
        ${input.promptTokens}, ${input.completionTokens}, ${Math.round(input.latencyMs)},
        ${input.aiResponse}, ${asJson(this.sql,input.assessment)}, ${asJson(this.sql,input.flags)},
        ${input.agentInstruction}, 'draft'
      ) returning *`;
    return mapGeneration(row);
  }

  async getGeneration(id: string): Promise<AiGeneration | null> {
    const [row] = await this.sql`select * from ai_generations where id = ${id}`;
    return row ? mapGeneration(row) : null;
  }

  async listGenerations(opts: { conversationId?: string; limit?: number } = {}): Promise<AiGeneration[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const rows = opts.conversationId
      ? await this.sql`
          select * from ai_generations where conversation_id = ${opts.conversationId}
          order by created_at desc limit ${limit}`
      : await this.sql`select * from ai_generations order by created_at desc limit ${limit}`;
    return rows.map(mapGeneration);
  }

  async supersedeDrafts(conversationId: string): Promise<number> {
    const rows = await this.sql`
      update ai_generations set status = 'superseded', resolved_at = now()
      where conversation_id = ${conversationId} and status = 'draft' returning id`;
    return rows.length;
  }

  async approveGeneration(
    id: string,
    finalResponse: string,
  ): Promise<{ generation: AiGeneration; message: Message } | null> {
    const result = await this.sql.begin(async (tx) => {
      const [g] = await tx`select * from ai_generations where id = ${id} and status = 'draft' for update`;
      if (!g) return null;
      const edited = finalResponse.trim() !== String(g.ai_response).trim();
      const [updated] = await tx`
        update ai_generations set
          agent_edited_response = ${edited ? finalResponse : null},
          final_response        = ${finalResponse},
          status                = 'approved',
          resolved_at           = now()
        where id = ${id} returning *`;
      const [msg] = await tx`
        insert into messages (id, conversation_id, sender, body, source, generation_id)
        values (${newId("msg")}, ${String(g.conversation_id)}, 'agent', ${finalResponse}, ${edited ? "ai_edited" : "ai_approved"}, ${id})
        returning *`;
      await tx`update conversations set updated_at = now() where id = ${String(g.conversation_id)}`;
      return { generation: mapGeneration(updated), message: mapMessage(msg) };
    });
    return result as { generation: AiGeneration; message: Message } | null;
  }

  async discardGeneration(id: string): Promise<AiGeneration | null> {
    const [row] = await this.sql`
      update ai_generations set status = 'discarded', resolved_at = now()
      where id = ${id} and status = 'draft' returning *`;
    return row ? mapGeneration(row) : null;
  }
}
