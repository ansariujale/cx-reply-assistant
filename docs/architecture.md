# Part 2: System design at scale

Diagram: [`architecture-diagram.png`](architecture-diagram.png) (also as SVG).

The app I built is one piece of this: the agent screen, the reply generation and the audit log. This document explains how I would grow it into a system for 500 brands, 5,000 agents and millions of messages, while keeping the same core ideas: the brand is decided when a message arrives, knowledge is retrieved for one brand only, the model is checked in code, and a human approves every outgoing message.

## 1. Architecture

**Frontend.** A React / Next.js app for agents on Vercel. It talks to the API with the agent's Supabase Auth token and uses Supabase Realtime to see new messages without refreshing. It never holds database credentials. Lists like the inbox and the logs are paginated and filtered on the server.

**API / backend.** Three parts that scale separately:

1. *Webhook receivers* for WhatsApp (Meta Cloud API), email and the web chat widget. They check the provider signature, build an idempotency key from the provider's message id, put the raw event on a queue and return 200 right away. They do no other work, so provider retries do not time out.
2. *Conversation API*: Next.js route handlers (and Supabase RPC where it is simpler) for conversations, messages, knowledge entries and approvals. Every query filters by the brands in the agent's token.
3. *Reply service*: the `generateReply` pipeline from the app, running as a queue worker instead of inside an HTTP request, because model calls take seconds and need retries and monitoring on their own.

**Database.** PostgreSQL on Supabase, with the same tables as the app plus `processed_events` (for duplicate webhooks), `outbox` (for sending), `assignments` and `kb_chunks`. `messages` and `ai_generations` are the big tables, so they get partitioned by month and indexed on `(conversation_id, created_at)` and `(brand_id, created_at)`. Row Level Security on `brand_id` is turned on for every table that belongs to a brand.

**Authentication.** Supabase Auth for agents and brand admins. The token carries the list of brands the agent can work on and their role. Workers use a service key that is never sent to the browser. Webhooks are verified with the provider signature plus a secret per brand. Each brand's channel credentials live in a secrets manager.

**External integrations.** One adapter per system (WhatsApp send and receive, email, order lookups in the CRM or Shopify). They all go through a small layer that adds timeouts, retries with backoff, and a circuit breaker so a slow provider cannot block everything else. Order facts are cached for a few minutes because customers usually send several messages about the same order.

**AI layer.** A model gateway in front of OpenRouter that handles model choice (a cheap model drafts by default, a stronger one only when the draft is flagged low-confidence or a brand pays for it), fallback providers, timeouts, token limits, prompt caching for the fixed part of the prompt, and a cost record per call with the brand and model. Prompts are versioned and the version is stored with each generation.

**Knowledge retrieval.** Keyword search in Postgres (like the app today) combined with embeddings in Qdrant, one collection per brand with the `brand_id` also stored in the payload and always used as a filter. Policies are split into chunks of a few hundred tokens and embedded by a background job whenever an entry is saved. The top 3 to 5 chunks go into the prompt with their ids, as now.

**Queues and background jobs.** A queue (Redis Streams, SQS, or pgmq inside Supabase) with three consumers: the ingest worker (dedupe, find the brand from the channel, save the customer, conversation and message, notify agents), the reply worker, and the sending worker. Scheduled jobs re-embed knowledge, run the nightly evaluation, roll up costs and archive old data.

## 2. Keeping brand data separate

I would enforce it in three places so a single mistake does not leak data:

1. **Database.** RLS policies compare the row's `brand_id` with the brands in the token. Workers set the current brand per transaction so the same rules apply to them. Qdrant has one collection per brand and a `brand_id` filter on every query.
2. **Application.** The brand is set by the ingest worker from the channel the message arrived on (which WhatsApp number or inbox), never from the message text, customer claims or agent input. The store has no "all brands" knowledge method, which is already true in this app.
3. **Prompt.** The prompt names one brand and only includes that brand's chunks. The entry ids the model says it used are checked against what was retrieved, and the audit log keeps exactly what the model saw. A nightly job replays generations and alerts if any retrieved chunk's brand differs from the conversation's brand.

On top of that: brand-scoped API keys for integrations, per-brand encryption of channel credentials, and the brand id on every log line so a leak would be visible.

## 3. Making the AI reliable

**Retrieval.** Measure it on its own with a small set of questions and the entries they should find, per brand, and run it whenever the knowledge base or the retriever changes. The `found / weak / none` status lets the system refuse rather than guess, and the agent always sees which entries were used.

**Hallucinations.** Several layers rather than one trick: a strict prompt with a fixed JSON output; the model's own self-assessment (grounded, confidence, missing information); checks in code that do not trust the model (numbers not in the policy, policy windows against the real delivery date, promise language, overriding a model that claims grounding with no knowledge); the human approval step; and, at scale, a second cheap model call for low-confidence drafts that checks each sentence against the retrieved text.

**Context.** Keep it small and predictable: order facts computed in code, the last few messages, the brand tone and only the retrieved chunks. The fixed part of the prompt is cached.

**Confidence and fallbacks.** Confidence combines the retrieval status, the model's self-assessment and the guardrail flags into "grounded / review / do not send". The fallbacks are explicit: no knowledge gives a holding reply and a note that the knowledge base has a gap; a provider failure gives a holding reply and an alert; low confidence goes to a stronger model or to a human queue, depending on the brand's settings.

**Evaluation.** The `ai_generations` log is the data set. Per brand and per model, track approval rate, how much agents edit the AI text, how often each flag fires, retrieval hit rate, latency and cost per approved reply. Replay a fixed set of cases whenever the prompt or model changes, and review a sample of flagged and edited drafts every week to fix tags and policy text.

## 4. Going from 20 to 500 brands

What I think breaks first, in order:

1. **Retrieval.** Keyword search over whole entries stops working when brands have hundreds of articles with overlapping words. Fix: chunking plus hybrid search per brand, background embedding on save, caching for busy brands, and the retrieval test set per brand.
2. **The model bill and rate limits.** Auto-drafting for 500 brands means millions of calls; one model on one provider hits rate limits and becomes the biggest cost. Fix: routing by difficulty, prompt caching, token limits, per-brand quotas, batch processing for anything not urgent, and a daily cost report per brand (see Part 3).
3. **Model calls inside HTTP requests.** Serverless timeouts and retries make this fragile. Fix: the reply worker on the queue, with the UI subscribing for the result.
4. **The big tables.** Millions of rows in `messages` and `ai_generations` slow down the inbox. Fix: monthly partitions, the right indexes, a read replica for the logs and analytics pages, archiving old partitions.
5. **One brand affecting the others.** A spike or a bad knowledge edit for one brand must not slow everyone down. Fix: per-brand fairness and quotas on the queue, feature flags per brand, dashboards per brand.

Also, at 500 brands the brand teams need to manage their own knowledge and tone in the UI, with versioning and a "preview reply" button to test a policy change before publishing it.

## 5. Reliability

**A webhook is received twice.** The receiver builds an idempotency key from the provider's message id and inserts it into `processed_events` (unique constraint) in the same transaction that saves the message. The second delivery hits the constraint and is acknowledged with 200 without doing anything. Drafts are tied to the customer message id, so a duplicate can never create a second draft or a second send.

**An external API times out.** Short, explicit timeouts at every step (webhook under 100 ms, order lookup about 2 s, model call about 25 s). Retries with backoff only for safe operations, a circuit breaker for a failing provider, and graceful degradation: generate without the order facts and flag it, or show a holding reply. Timeouts are tracked as metrics with alerts per provider.

**An AI request fails.** Retry once on temporary errors, fall over to the next model in the list, and if everything fails store a generation with the `LLM_UNAVAILABLE` flag and a holding reply so the agent can still act. Failure rates per provider are tracked, and sustained failures switch the routing automatically. Nothing is ever sent automatically because of a failure.

**A message was processed but the reply was not sent.** Sending never happens directly from the request. Approving a reply writes the message and an `outbox` row in one transaction. A sending worker reads the outbox, sends with the provider's idempotency key, and marks the row as sent. If the worker crashes mid-way the row is retried with the same key, so the customer gets exactly one message. Rows that keep failing go to a dead-letter queue, raise an alert, and show up in the agent UI as "not delivered" with a retry button. WhatsApp delivery receipts update the message status.

The common idea: write what you intend to do to the database first, do the side effects from those records, make every step safe to repeat, and show the state to the people responsible for it.
