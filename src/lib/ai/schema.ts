import { z } from "zod";

/** Tolerant boolean: models occasionally emit "true"/"false" as strings. */
const bool = z.preprocess((v) => {
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return v;
}, z.boolean());

const stringArray = z.preprocess((v) => {
  if (v == null) return [];
  if (typeof v === "string") return v.trim() ? [v] : [];
  return v;
}, z.array(z.string()));

/**
 * Contract for the model's structured output. Everything except `reply` is
 * defaulted conservatively so a partially-compliant answer degrades to
 * "low confidence, needs review" instead of failing or looking confident.
 */
export const llmOutputSchema = z.object({
  reply: z.string().trim().min(1),
  confidence: z
    .preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.enum(["high", "medium", "low"]))
    .default("low"),
  grounded: bool.default(false),
  used_entry_ids: stringArray.default([]),
  missing_information: stringArray.default([]),
  needs_human_review: bool.default(false),
  rationale: z.string().default(""),
});

export type LlmOutput = z.infer<typeof llmOutputSchema>;

/** Pulls the first {...} block out of a response, tolerating code fences and chatter. */
export function extractJson(text: string): string | null {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}

export type ParseResult = { ok: true; value: LlmOutput } | { ok: false; error: string };

export function parseLlmOutput(text: string): ParseResult {
  const candidate = extractJson(text);
  if (!candidate) return { ok: false, error: "No JSON object found in model output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  const result = llmOutputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; "),
    };
  }
  return { ok: true, value: result.data };
}
