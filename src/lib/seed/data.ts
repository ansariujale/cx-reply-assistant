import type { Brand, Conversation, Customer, KbEntry, Message, Order } from "@/lib/domain/types";

export interface SeedData {
  brands: Brand[];
  kbEntries: KbEntry[];
  customers: Customer[];
  orders: Order[];
  conversations: Conversation[];
  messages: Message[];
}

const daysAgo = (now: Date, days: number, hours = 0): string =>
  new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();

const minutesAgo = (now: Date, minutes: number): string =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

/**
 * Two brands whose policies differ on purpose (refund windows, damage
 * reporting windows, refund method, express shipping, cancellation windows)
 * so that cross-brand leakage is easy to spot during review.
 *
 * Dates are relative to `now` so the demo scenarios ("delivered 2 days ago",
 * "received 20 days ago") stay true whenever the data is (re)seeded.
 */
export function buildSeed(now: Date = new Date()): SeedData {
  const created = daysAgo(now, 60);

  const glow: Brand = {
    id: "brand_glowco",
    slug: "glow-co",
    name: "Glow & Co.",
    description: "Premium skincare sold direct-to-consumer. Glass bottles, fragile shipments.",
    tone:
      "Warm, reassuring and personal. Use the customer's first name once, keep sentences short, avoid jargon, never sound robotic.",
    supportEmail: "care@glowandco.example",
    accentColor: "#db2777",
    createdAt: created,
  };

  const peak: Brand = {
    id: "brand_peakfuel",
    slug: "peak-fuel",
    name: "Peak Fuel",
    description: "Sports nutrition and supplements. Consumables with strict hygiene rules.",
    tone:
      "Direct, upbeat and concise. Friendly but no fluff; get to the point in two or three sentences and be clear about what happens next.",
    supportEmail: "support@peakfuel.example",
    accentColor: "#2563eb",
    createdAt: created,
  };

  const kb = (
    id: string,
    brandId: string,
    category: KbEntry["category"],
    title: string,
    content: string,
    tags: string[],
  ): KbEntry => ({ id, brandId, category, title, content, tags, createdAt: created, updatedAt: created });

  const kbEntries: KbEntry[] = [
    /* ---------------- Glow & Co. ---------------- */
    kb(
      "kb_glow_returns",
      glow.id,
      "returns",
      "Returns for unopened products",
      "Customers can return unopened, sealed products in their original packaging within 30 days of delivery. We arrange a free doorstep pickup within 2 business days of the return being approved. For hygiene reasons, opened skincare products cannot be returned unless they arrived damaged, defective or were the wrong item. Returns are initiated through WhatsApp or email with the order number.",
      ["return", "unopened", "sealed", "pickup", "30 days", "hygiene", "exchange"],
    ),
    kb(
      "kb_glow_refunds",
      glow.id,
      "refunds",
      "Refund policy",
      "Refunds are available within 30 days of delivery for eligible returns and for items that arrived damaged, defective or incorrect. Refunds go back to the original payment method within 5 to 7 business days after the pickup is confirmed. Cash-on-delivery orders are refunded to a bank account, with details collected securely by the agent. Shipping fees are non-refundable unless the item was damaged, defective or wrong. We do not force store credit; the customer chooses.",
      ["refund", "money back", "30 days", "original payment method", "5-7 business days", "cod", "shipping fee"],
    ),
    kb(
      "kb_glow_shipping",
      glow.id,
      "shipping",
      "Shipping and delivery",
      "Standard shipping is free on orders over Rs 999, otherwise Rs 79. Standard delivery takes 3 to 5 business days in metro cities and 5 to 7 business days elsewhere. Express delivery (1 to 2 business days) is available in select metros for Rs 149. Orders are dispatched within 24 hours, Monday to Saturday, and a tracking link is sent by SMS and WhatsApp. If tracking shows no movement for 3 business days, the agent should raise a ticket with the courier partner and keep the customer informed.",
      ["shipping", "delivery", "tracking", "express", "late", "delayed", "where is my order", "courier", "dispatch"],
    ),
    kb(
      "kb_glow_cancellations",
      glow.id,
      "cancellations",
      "Cancellation policy",
      "Orders can be cancelled free of charge at any time before dispatch, which is usually within 2 hours of placing the order, from the My Orders page or by contacting support. Once an order has been dispatched it can no longer be cancelled, but the customer may refuse the delivery or return it under the returns policy. Prepaid cancellations are refunded to the original payment method within 3 to 5 business days.",
      ["cancel", "cancellation", "before dispatch", "2 hours", "prepaid", "refuse delivery"],
    ),
    kb(
      "kb_glow_damaged",
      glow.id,
      "general",
      "Damaged, broken or leaking items on arrival",
      "If a product arrives damaged, broken, cracked or leaking, the customer should report it within 7 days of delivery and share a photo of the item and the outer packaging. We then offer a free replacement, dispatched within 24 to 48 hours, or a full refund including shipping; the customer chooses. The damaged product does not need to be returned. If a photo is not available the agent can still raise a claim, which goes through a 24-hour review.",
      ["damaged", "broken", "cracked", "leaking", "shattered", "replacement", "photo", "7 days", "transit"],
    ),

    /* ---------------- Peak Fuel ---------------- */
    kb(
      "kb_peak_returns",
      peak.id,
      "returns",
      "Returns on supplements",
      "Supplements are consumables, so opened or unsealed products cannot be returned under any circumstances. Unopened products with the seal intact can be returned within 14 days of delivery. The customer pays return shipping unless we shipped the wrong item. Every return must be approved by support before the product is sent back; unapproved returns are not processed.",
      ["return", "unopened", "sealed", "consumable", "14 days", "approval", "exchange"],
    ),
    kb(
      "kb_peak_refunds",
      peak.id,
      "refunds",
      "Refund policy",
      "Refunds are only permitted within 7 days of delivery. By default refunds are issued as Peak Fuel store credit within 48 hours of the return being received. A refund to the original payment method is only offered when the product was damaged, defective or the wrong item, and is processed within 7 to 10 business days. Change-of-mind requests after 7 days are not eligible for a refund or store credit.",
      ["refund", "money back", "7 days", "store credit", "original payment method", "7-10 business days", "taste", "change of mind"],
    ),
    kb(
      "kb_peak_shipping",
      peak.id,
      "shipping",
      "Shipping policy",
      "Shipping is a flat Rs 99, free on orders over Rs 1,499. Delivery takes 4 to 7 business days across India; there is no express option. Orders ship from our Bengaluru warehouse Monday to Friday. We do not ship internationally. Delays are possible during sale periods; if an order has not been delivered within 10 business days of dispatch, the agent escalates to the logistics team.",
      ["shipping", "delivery", "tracking", "late", "delayed", "where is my order", "international", "flat rate"],
    ),
    kb(
      "kb_peak_cancellations",
      peak.id,
      "cancellations",
      "Cancellation policy",
      "An order can be cancelled from the app within 1 hour of being placed. After 1 hour the order is locked for packing and cannot be cancelled. If a customer refuses delivery, the order is treated as a return and Rs 150 return shipping is deducted from the refund. Prepaid cancellation refunds reach the original payment method in 5 to 7 business days.",
      ["cancel", "cancellation", "1 hour", "locked", "refuse delivery", "prepaid"],
    ),
    kb(
      "kb_peak_damaged",
      peak.id,
      "general",
      "Damaged or tampered products",
      "Damaged, leaking or tampered products must be reported within 48 hours of delivery with a photo or video showing the seal and the packaging. We ship a free replacement; a refund (not store credit) is offered only if the replacement is out of stock. Reports made after 48 hours are assessed case by case by the CX lead and a replacement is not guaranteed.",
      ["damaged", "broken", "leaking", "tampered", "seal", "replacement", "48 hours", "photo", "video"],
    ),
  ];

  const customers: Customer[] = [
    { id: "cust_priya", brandId: glow.id, name: "Priya Sharma", email: "priya.sharma@example.com", phone: "+91 98100 11223" },
    { id: "cust_ananya", brandId: glow.id, name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "+91 98200 44556" },
    { id: "cust_rahul", brandId: peak.id, name: "Rahul Verma", email: "rahul.verma@example.com", phone: "+91 99870 77889" },
    { id: "cust_karan", brandId: peak.id, name: "Karan Mehta", email: "karan.mehta@example.com", phone: "+91 98111 22334" },
  ];

  const orders: Order[] = [
    {
      id: "order_gc_10482",
      brandId: glow.id,
      customerId: "cust_priya",
      orderNumber: "GC-10482",
      status: "delivered",
      items: [
        { name: "Vitamin C Glow Serum 30ml (glass bottle)", quantity: 1, unitPrice: 1299 },
        { name: "Hydra Cloud Moisturiser 50ml", quantity: 1, unitPrice: 899 },
      ],
      total: 2198,
      currency: "INR",
      orderedAt: daysAgo(now, 6, 3),
      shippedAt: daysAgo(now, 5, 6),
      deliveredAt: daysAgo(now, 2, 4),
    },
    {
      id: "order_gc_10511",
      brandId: glow.id,
      customerId: "cust_ananya",
      orderNumber: "GC-10511",
      status: "shipped",
      items: [{ name: "Rosewater Toner 200ml", quantity: 2, unitPrice: 549 }],
      total: 1098,
      currency: "INR",
      orderedAt: daysAgo(now, 5, 2),
      shippedAt: daysAgo(now, 4, 5),
      deliveredAt: null,
    },
    {
      id: "order_pf_7731",
      brandId: peak.id,
      customerId: "cust_rahul",
      orderNumber: "PF-7731",
      status: "delivered",
      items: [{ name: "Whey Isolate, Chocolate 1kg", quantity: 1, unitPrice: 2499 }],
      total: 2499,
      currency: "INR",
      orderedAt: daysAgo(now, 24, 1),
      shippedAt: daysAgo(now, 23, 4),
      deliveredAt: daysAgo(now, 20, 2),
    },
    {
      id: "order_pf_7802",
      brandId: peak.id,
      customerId: "cust_karan",
      orderNumber: "PF-7802",
      status: "delivered",
      items: [
        { name: "Creatine Monohydrate 250g", quantity: 1, unitPrice: 899 },
        { name: "Steel Shaker Bottle 700ml", quantity: 1, unitPrice: 299 },
      ],
      total: 1198,
      currency: "INR",
      orderedAt: daysAgo(now, 3, 5),
      shippedAt: daysAgo(now, 2, 7),
      deliveredAt: daysAgo(now, 1, 3),
    },
  ];

  const conversations: Conversation[] = [
    {
      id: "conv_glow_broken_bottle",
      brandId: glow.id,
      customerId: "cust_priya",
      orderId: "order_gc_10482",
      channel: "whatsapp",
      status: "open",
      subject: "Broken bottle on delivery",
      createdAt: daysAgo(now, 2, 1),
      updatedAt: minutesAgo(now, 12),
    },
    {
      id: "conv_peak_late_refund",
      brandId: peak.id,
      customerId: "cust_rahul",
      orderId: "order_pf_7731",
      channel: "whatsapp",
      status: "open",
      subject: "Refund request 20 days after delivery",
      createdAt: minutesAgo(now, 35),
      updatedAt: minutesAgo(now, 35),
    },
    {
      id: "conv_glow_tracking",
      brandId: glow.id,
      customerId: "cust_ananya",
      orderId: "order_gc_10511",
      channel: "email",
      status: "open",
      subject: "Tracking has not updated",
      createdAt: minutesAgo(now, 95),
      updatedAt: minutesAgo(now, 95),
    },
    {
      id: "conv_peak_gift_wrap",
      brandId: peak.id,
      customerId: "cust_karan",
      orderId: "order_pf_7802",
      channel: "web",
      status: "open",
      subject: "Gift wrapping question",
      createdAt: minutesAgo(now, 150),
      updatedAt: minutesAgo(now, 150),
    },
  ];

  const msg = (
    id: string,
    conversationId: string,
    sender: Message["sender"],
    body: string,
    createdAt: string,
  ): Message => ({ id, conversationId, sender, body, source: "human", generationId: null, createdAt });

  const messages: Message[] = [
    msg("msg_glow_1", "conv_glow_broken_bottle", "customer", "Hi! I placed order GC-10482 last week and it arrived on Saturday.", daysAgo(now, 2, 1)),
    msg("msg_glow_2", "conv_glow_broken_bottle", "agent", "Hi Priya, thanks for reaching out! I can see GC-10482 was delivered. How can I help you today?", daysAgo(now, 2, 0)),
    msg("msg_glow_3", "conv_glow_broken_bottle", "customer", "My order was delivered but the bottle is broken. What can I do?", minutesAgo(now, 12)),
    msg("msg_peak_1", "conv_peak_late_refund", "customer", "I received this 20 days ago. Can I get a refund? I didn't like the taste at all.", minutesAgo(now, 35)),
    msg("msg_track_1", "conv_glow_tracking", "customer", "It has been 4 days since my order shipped and the tracking page has not updated at all. Where is my order?", minutesAgo(now, 95)),
    msg("msg_gift_1", "conv_peak_gift_wrap", "customer", "Do you offer gift wrapping? I want to send a second order as a Diwali gift to my brother.", minutesAgo(now, 150)),
  ];

  return { brands: [glow, peak], kbEntries, customers, orders, conversations, messages };
}
