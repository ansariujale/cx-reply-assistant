import { randomUUID } from "node:crypto";

/** Prefixed ids generated in the app (not the DB) so both store adapters behave identically. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
