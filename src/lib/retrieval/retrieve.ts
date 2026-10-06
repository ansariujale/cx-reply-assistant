import type { KbEntry, RetrievalStatus, RetrievedChunk } from "@/lib/domain/types";
import { expandQuery } from "./synonyms";
import { tokenize } from "./tokenize";

export interface RetrievalOptions {
  topK?: number;
  /** Below this the knowledge base is treated as having nothing relevant. */
  noneBelow?: number;
  /** Between noneBelow and this the match is reported as weak. */
  weakBelow?: number;
  /** Weight applied to synonym-expanded terms relative to literal query terms. */
  expansionWeight?: number;
  /** Flat bonus for a query term that appears in an entry's curated title or tags. */
  curatedBonus?: number;
}

export interface RetrievalResult {
  query: string;
  status: RetrievalStatus;
  chunks: RetrievedChunk[];
  queryTerms: string[];
  expandedTerms: string[];
}

const DEFAULTS: Required<RetrievalOptions> = {
  topK: 3,
  noneBelow: 0.8,
  weakBelow: 1.8,
  expansionWeight: 0.6,
  curatedBonus: 1.0,
};

const K1 = 1.5;
const B = 0.75;

interface IndexedDoc {
  entry: KbEntry;
  tf: Map<string, number>;
  curated: Set<string>;
  length: number;
}

function indexEntry(entry: KbEntry): IndexedDoc {
  const titleTokens = tokenize(entry.title);
  const tagTokens = tokenize(entry.tags.join(" "));
  const tokens = [...titleTokens, ...tagTokens, ...tokenize(entry.content)];
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { entry, tf, curated: new Set([...titleTokens, ...tagTokens]), length: tokens.length };
}

/**
 * Brand-scoped lexical retrieval: BM25 over the entry text plus a flat bonus
 * for hits in the curated title/tags, with synonym expansion of the query.
 *
 * Isolation is structural: this function only ever sees the entries the
 * caller passes in, and the caller obtains them with `store.listKbEntries(brandId)`.
 * There is no code path that can mix brands inside the ranker.
 *
 * Why lexical and not embeddings: each brand has a handful of short, topical
 * policies. BM25 over curated titles/tags is deterministic, explainable
 * (matched terms are shown to the agent), free, and has no infrastructure.
 * The curated bonus matters on a tiny corpus, where IDF alone under-weights a
 * word such as "refund" that legitimately appears in several policies.
 * The interface returns ranked chunks plus a status, so swapping in a vector
 * store (e.g. Qdrant with one collection per brand) later is a local change.
 */
export function retrieve(query: string, entries: KbEntry[], options: RetrievalOptions = {}): RetrievalResult {
  const opts = { ...DEFAULTS, ...options };
  const queryTerms = tokenize(query);
  const querySet = new Set(queryTerms);
  const expandedTerms = expandQuery(query, querySet);

  if (entries.length === 0 || (querySet.size === 0 && expandedTerms.length === 0)) {
    return { query, status: "none", chunks: [], queryTerms, expandedTerms };
  }

  const docs = entries.map(indexEntry);
  const n = docs.length;
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / n;

  const df = new Map<string, number>();
  for (const d of docs) for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const idf = (term: string): number => {
    const dfi = df.get(term) ?? 0;
    return Math.log(1 + (n - dfi + 0.5) / (dfi + 0.5));
  };

  const weighted: Array<[string, number]> = [
    ...[...querySet].map((t): [string, number] => [t, 1]),
    ...expandedTerms.map((t): [string, number] => [t, opts.expansionWeight]),
  ];

  const scored = docs.map((d) => {
    let score = 0;
    const matched: string[] = [];
    for (const [term, weight] of weighted) {
      const tf = d.tf.get(term);
      if (!tf) continue;
      const norm = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + (B * d.length) / avgLength);
      score += weight * idf(term) * (norm / denom);
      if (d.curated.has(term)) score += weight * opts.curatedBonus;
      matched.push(term);
    }
    return { d, score, matched };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;

  let status: RetrievalStatus = "found";
  if (top < opts.noneBelow) status = "none";
  else if (top < opts.weakBelow) status = "weak";

  const chunks: RetrievedChunk[] =
    status === "none"
      ? []
      : scored
          .filter((s) => s.score > 0 && s.score >= top * 0.3)
          .slice(0, opts.topK)
          .map((s) => ({
            entryId: s.d.entry.id,
            title: s.d.entry.title,
            category: s.d.entry.category,
            content: s.d.entry.content,
            score: Math.round(s.score * 100) / 100,
            matchedTerms: s.matched,
          }));

  return { query, status, chunks, queryTerms, expandedTerms };
}
