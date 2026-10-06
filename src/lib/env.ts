/**
 * Central, lazily-read runtime configuration. Read at call time (not import
 * time) so `next build` does not bake values in and tests can override env.
 */
export interface AppEnv {
  openRouterApiKey: string | null;
  openRouterModel: string;
  openRouterFallbackModels: string[];
  databaseUrl: string | null;
  appUrl: string;
  generateRateLimitPerMinute: number;
}

const clean = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

export function getEnv(): AppEnv {
  return {
    openRouterApiKey: clean(process.env.OPENROUTER_API_KEY),
    openRouterModel: clean(process.env.OPENROUTER_MODEL) ?? "openai/gpt-4o-mini",
    openRouterFallbackModels: (clean(process.env.OPENROUTER_FALLBACK_MODELS) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    databaseUrl: clean(process.env.DATABASE_URL),
    appUrl: clean(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
    generateRateLimitPerMinute: Number(clean(process.env.GENERATE_RATE_LIMIT_PER_MINUTE) ?? 10) || 10,
  };
}
