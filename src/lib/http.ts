import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { GenerationError } from "@/lib/ai/generateReply";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, ...(details === undefined ? {} : { details }) }, { status });
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Parses and validates a JSON body. An empty body is treated as `undefined` so schema defaults apply. */
export async function readJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<Parsed<T>> {
  let body: unknown;
  try {
    const text = await req.text();
    body = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, response: fail(400, "Request body must be valid JSON") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: fail(
        400,
        result.error.issues[0]?.message ?? "Invalid request",
        result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      ),
    };
  }
  return { ok: true, data: result.data };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Maps known error types to HTTP responses and hides internals for the rest. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof GenerationError) return fail(err.status, err.message);
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return fail(500, process.env.NODE_ENV === "production" ? "Internal server error" : message);
}
