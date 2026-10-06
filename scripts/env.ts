/**
 * Loads .env.local then .env (Next.js convention) for standalone scripts.
 * Uses Node's built-in loader (>= 20.12) so no extra dependency is needed.
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file not present: fine
    }
  }
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  return url;
}
