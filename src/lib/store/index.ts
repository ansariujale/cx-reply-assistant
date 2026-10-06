import { getEnv } from "@/lib/env";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { Store } from "./types";

type GlobalWithStore = typeof globalThis & { __cxStore?: Store };

/**
 * Returns the process-wide store. Postgres when DATABASE_URL is set, otherwise
 * the seeded in-memory store. Cached on globalThis so Next.js dev hot reloads
 * do not create a fresh (empty) store on every file change.
 */
export function getStore(): Store {
  const g = globalThis as GlobalWithStore;
  if (g.__cxStore) return g.__cxStore;
  const { databaseUrl } = getEnv();
  const store: Store = databaseUrl ? PostgresStore.fromUrl(databaseUrl) : new MemoryStore();
  g.__cxStore = store;
  return store;
}

export type { Store } from "./types";
