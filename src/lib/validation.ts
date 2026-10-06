import { z } from "zod";

export const kbCategorySchema = z.enum(["returns", "refunds", "shipping", "cancellations", "general"]);

/** Accepts either an array of tags or a comma-separated string; normalises to a unique string[]. */
const tagsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => {
    const raw = typeof v === "string" ? v.split(",") : v;
    return [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
  })
  .pipe(z.array(z.string().min(1).max(40, "Tags must be 40 characters or fewer")).max(20, "At most 20 tags"));

export const kbEntryBodySchema = z.object({
  category: kbCategorySchema,
  title: z.string().trim().min(2, "Title is too short").max(120, "Title is too long"),
  content: z.string().trim().min(10, "Content is too short").max(4000, "Content is too long"),
  tags: tagsSchema.default([]),
});

export type KbEntryBody = z.output<typeof kbEntryBodySchema>;

export const kbEntryPatchSchema = z
  .object({
    category: kbCategorySchema,
    title: z.string().trim().min(2, "Title is too short").max(120, "Title is too long"),
    content: z.string().trim().min(10, "Content is too short").max(4000, "Content is too long"),
    tags: tagsSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const messageBodySchema = z.object({
  sender: z.enum(["customer", "agent"]),
  body: z.string().trim().min(1, "Message cannot be empty").max(4000),
});

export const generateBodySchema = z
  .object({
    instruction: z.string().trim().max(500, "Instruction is too long").nullish(),
  })
  .default({});

export const generationActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    finalResponse: z.string().trim().min(1, "The reply cannot be empty").max(4000),
  }),
  z.object({ action: z.literal("discard") }),
]);
