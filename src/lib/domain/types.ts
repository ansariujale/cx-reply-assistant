/**
 * Shared domain model. Every adapter (in-memory, Postgres) and every API
 * route speaks in these shapes, so the UI never depends on storage details.
 */

export type KbCategory = "returns" | "refunds" | "shipping" | "cancellations" | "general";

export const KB_CATEGORIES: readonly KbCategory[] = [
  "returns",
  "refunds",
  "shipping",
  "cancellations",
  "general",
] as const;

export const KB_CATEGORY_LABELS: Record<KbCategory, string> = {
  returns: "Return policy",
  refunds: "Refund policy",
  shipping: "Shipping policy",
  cancellations: "Cancellation policy",
  general: "General / other",
};

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Free-text tone guidance injected into the system prompt. */
  tone: string;
  supportEmail: string;
  /** Hex colour used for brand chips in the UI. */
  accentColor: string;
  createdAt: string;
}

export interface KbEntry {
  id: string;
  brandId: string;
  category: KbCategory;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KbEntryInput {
  brandId: string;
  category: KbCategory;
  title: string;
  content: string;
  tags: string[];
}

export interface Customer {
  id: string;
  brandId: string;
  name: string;
  email: string;
  phone: string;
}

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  brandId: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  currency: string;
  orderedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export type Channel = "whatsapp" | "email" | "web";
export type ConversationStatus = "open" | "resolved";

export interface Conversation {
  id: string;
  /** The brand is bound to the conversation by the channel it arrived on. */
  brandId: string;
  customerId: string;
  orderId: string | null;
  channel: Channel;
  status: ConversationStatus;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export type Sender = "customer" | "agent";
/** How an agent message came to exist; customer messages are always "human". */
export type MessageSource = "human" | "ai_approved" | "ai_edited";

export interface Message {
  id: string;
  conversationId: string;
  sender: Sender;
  body: string;
  source: MessageSource;
  generationId: string | null;
  createdAt: string;
}

export interface MessageInput {
  conversationId: string;
  sender: Sender;
  body: string;
  source: MessageSource;
  generationId?: string | null;
}

export interface ConversationSummary extends Conversation {
  brand: Brand;
  customer: Customer;
  lastMessage: Message | null;
  messageCount: number;
}

export interface ConversationDetail extends Conversation {
  brand: Brand;
  customer: Customer;
  order: Order | null;
  messages: Message[];
}

/* ------------------------------------------------------------------ */
/* AI pipeline                                                         */
/* ------------------------------------------------------------------ */

export type RetrievalStatus = "found" | "weak" | "none";

export interface RetrievedChunk {
  entryId: string;
  title: string;
  category: KbCategory;
  content: string;
  /** BM25 score; only meaningful relative to other chunks in the same run. */
  score: number;
  matchedTerms: string[];
}

export type Confidence = "high" | "medium" | "low";

/** The model's structured self-assessment, validated before use. */
export interface AiAssessment {
  confidence: Confidence;
  /** True only if every factual claim is supported by retrieved knowledge or order facts. */
  grounded: boolean;
  usedEntryIds: string[];
  missingInformation: string[];
  needsHumanReview: boolean;
  /** One line for the agent, never shown to the customer. */
  rationale: string;
}

export type FlagSeverity = "info" | "warning" | "critical";

export interface GuardrailFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

export type GenerationStatus = "draft" | "approved" | "discarded" | "superseded";

export interface AiGeneration {
  id: string;
  conversationId: string;
  brandId: string;
  customerMessageId: string | null;
  customerMessage: string;
  retrievalQuery: string;
  retrievalStatus: RetrievalStatus;
  retrievedContext: RetrievedChunk[];
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  aiResponse: string;
  assessment: AiAssessment;
  flags: GuardrailFlag[];
  agentInstruction: string | null;
  agentEditedResponse: string | null;
  finalResponse: string | null;
  status: GenerationStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export type GenerationInput = Omit<
  AiGeneration,
  "id" | "createdAt" | "status" | "resolvedAt" | "agentEditedResponse" | "finalResponse"
>;
