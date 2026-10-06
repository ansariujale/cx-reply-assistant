# Part 3, Scenario 1: AI costs went from ₹20k to ₹1 lakh a month

**The number that stands out.** Conversations grew by about 40%, so I would expect the bill to be around ₹28k if nothing else changed. It is ₹1 lakh, so the cost per conversation has gone up roughly 3.5 times. Volume is not the explanation. Something changed in how much AI work we do per conversation, or how expensive each call is, or both. I would treat this like a bug and work through a list of likely causes.

## 1. What I would investigate

**First, get the numbers.** If we cannot break the bill down by brand, model, feature and day, that is the first thing to fix, because everything else depends on it. OpenRouter shows usage per key and per request, and our own `ai_generations` table already stores the model and the prompt and completion tokens for every call. Joining those two is a one-day job. Then I would look for the week where cost per conversation jumped and check what was released that week.

**Likely causes, in the order I would check them:**

1. **A more expensive model crept in.** Someone changed the default "for quality", a fallback list quietly routes to a pricey model when the cheap one is rate limited, or a reasoning model is being used and its hidden reasoning tokens are billed. A call with 2,000 input and 300 output tokens costs about $0.0005 on `gpt-4o-mini` and about $0.01 on a $3 / $15 per million model, which is 20 times more. This alone can explain the whole increase.
2. **Prompts got bigger.** The whole knowledge base pasted into the prompt instead of the top 3 entries, unlimited conversation history, long examples added to the prompt, raw order history dumped in. Check the average prompt tokens per call over time.
3. **More calls per conversation.** Drafting automatically on every incoming message (including "thanks"), regenerate loops, duplicate webhooks each creating a draft, retries that are billed, new features like per-message classification or summaries added next to drafting, embeddings recomputed on every request instead of when a policy changes. Check calls per conversation and how many drafts were never even opened by an agent.
4. **Longer outputs.** `max_tokens` raised, prompts asking for long replies, the model echoing the context back in its JSON. Check completion tokens per call.
5. **No caching.** The system prompt and the brand policies are the same for thousands of calls; without prompt caching we pay full price each time. The same common questions get answered from scratch.
6. **Non-production traffic on the production key.** Load tests, evaluations, developer loops, a demo environment with an open generate endpoint, or a scraper hitting a public URL. Check usage by key and by time of day.
7. **Retrieval got worse.** If retrieval quality dropped, agents regenerate more and someone may have added more context "to be safe". Check the regenerate rate and the retrieval status over time.

## 2. What I would change

**Right away (days):**

- **Cost tracking and budgets.** Store the cost of every call (model price times tokens) on the `ai_generations` row and roll it up daily per brand, model and feature. Add alerts for daily spend, cost per conversation and prompt size, so the next drift is caught in a day rather than a quarter. Separate keys per environment, each with a spend limit.
- **Use the right model for the job.** Drafting a reply from three policy entries is a small-model task. Use a `gpt-4o-mini` / `gemini-flash-lite` class model by default and only escalate when the guardrails flag low confidence or a brand explicitly pays for a stronger model. Make the fallback list cost-aware.
- **Limit tokens.** Set `max_tokens` to what a reply needs (a WhatsApp reply is under 150 words), keep only the last few messages, send the top few retrieved entries instead of the whole knowledge base, and trim boilerplate from prompts.
- **Stop paying for calls nobody uses.** Only draft when an agent opens the conversation or when the message actually needs a reply; dedupe webhooks so a duplicate can never trigger a second generation; make regenerate ask for a reason or instruction.

**Next (weeks):**

- **Prompt caching** for the fixed system and brand part of the prompt (providers charge much less for cached input), with the stable part placed first.
- **Answer caching** for common, deterministic questions, keyed by brand plus knowledge base version plus the normalised question, with human-approved answers.
- **Batching and async** for anything that is not interactive (summaries, evaluations, re-embedding) using cheaper batch endpoints.
- **Rate limits and quotas** per agent and per brand so one bug or one brand's spike cannot use up the month's budget.
- **Quality next to cost.** Track cost per approved reply and the edit rate per model. A cheaper model that agents edit twice as often is not actually cheaper. Use the test set to confirm the cheap default is good enough before switching.

**Architecture:**

- Put every model call behind one gateway that handles model routing, budgets, timeouts, caching and logging, so cost controls live in one place.
- Make generation a queue job rather than an inline HTTP call, which gives natural backpressure and clean retries.
- Version prompts and store the version with each generation, so a cost or quality change can be traced to a specific change and rolled back.

## 3. How I would know it worked

Cost per conversation back near the original level within two weeks, with the approval rate and edit rate unchanged on the test set; a dashboard showing cost by brand, model and feature every morning; and an alert that fires on a 30% week-over-week change in cost per conversation. The goal is not just a lower bill this month but making sure the bill cannot drift silently again.
