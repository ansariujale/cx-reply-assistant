import type { Sql } from "postgres";
import type { SeedData } from "@/lib/seed/data";
import { asJson } from "./postgres";

export interface SeedOptions {
  /** Truncate every table (including AI generation history) before inserting. */
  reset?: boolean;
}

/**
 * Upserts the demo data set. Re-running refreshes the relative dates
 * ("delivered 20 days ago") without wiping AI generation history unless
 * `reset` is requested. Shared by `scripts/seed.ts` and the integration tests.
 */
export async function seedPostgres(sql: Sql, seed: SeedData, options: SeedOptions = {}): Promise<void> {
  await sql.begin(async (tx) => {
    if (options.reset) {
      await tx`truncate ai_generations, messages, conversations, orders, customers, kb_entries, brands cascade`;
    }

    for (const b of seed.brands) {
      await tx`
        insert into brands (id, slug, name, description, tone, support_email, accent_color, created_at)
        values (${b.id}, ${b.slug}, ${b.name}, ${b.description}, ${b.tone}, ${b.supportEmail}, ${b.accentColor}, ${b.createdAt})
        on conflict (id) do update set
          slug = excluded.slug, name = excluded.name, description = excluded.description,
          tone = excluded.tone, support_email = excluded.support_email, accent_color = excluded.accent_color`;
    }

    for (const e of seed.kbEntries) {
      await tx`
        insert into kb_entries (id, brand_id, category, title, content, tags, created_at, updated_at)
        values (${e.id}, ${e.brandId}, ${e.category}, ${e.title}, ${e.content}, ${asJson(tx, e.tags)}, ${e.createdAt}, ${e.updatedAt})
        on conflict (id) do update set
          category = excluded.category, title = excluded.title, content = excluded.content,
          tags = excluded.tags, updated_at = now()`;
    }

    for (const c of seed.customers) {
      await tx`
        insert into customers (id, brand_id, name, email, phone)
        values (${c.id}, ${c.brandId}, ${c.name}, ${c.email}, ${c.phone})
        on conflict (id) do update set
          brand_id = excluded.brand_id, name = excluded.name, email = excluded.email, phone = excluded.phone`;
    }

    for (const o of seed.orders) {
      await tx`
        insert into orders (id, brand_id, customer_id, order_number, status, items, total, currency, ordered_at, shipped_at, delivered_at)
        values (${o.id}, ${o.brandId}, ${o.customerId}, ${o.orderNumber}, ${o.status}, ${asJson(tx, o.items)}, ${o.total}, ${o.currency}, ${o.orderedAt}, ${o.shippedAt}, ${o.deliveredAt})
        on conflict (id) do update set
          status = excluded.status, items = excluded.items, total = excluded.total,
          ordered_at = excluded.ordered_at, shipped_at = excluded.shipped_at, delivered_at = excluded.delivered_at`;
    }

    for (const c of seed.conversations) {
      await tx`
        insert into conversations (id, brand_id, customer_id, order_id, channel, status, subject, created_at, updated_at)
        values (${c.id}, ${c.brandId}, ${c.customerId}, ${c.orderId}, ${c.channel}, ${c.status}, ${c.subject}, ${c.createdAt}, ${c.updatedAt})
        on conflict (id) do update set
          order_id = excluded.order_id, channel = excluded.channel, subject = excluded.subject,
          created_at = excluded.created_at, updated_at = excluded.updated_at`;
    }

    for (const m of seed.messages) {
      await tx`
        insert into messages (id, conversation_id, sender, body, source, generation_id, created_at)
        values (${m.id}, ${m.conversationId}, ${m.sender}, ${m.body}, ${m.source}, ${m.generationId}, ${m.createdAt})
        on conflict (id) do update set body = excluded.body, created_at = excluded.created_at`;
    }
  });
}
