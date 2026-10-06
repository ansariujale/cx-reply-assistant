import { buildSeed } from "../src/lib/seed/data";
import { createSql } from "../src/lib/store/postgres";
import { seedPostgres } from "../src/lib/store/postgres-seed";
import { loadEnv, requireDatabaseUrl } from "./env";

/**
 * Seeds (or refreshes) the demo brands, knowledge bases, customers, orders and
 * conversations.
 *
 *   npm run db:seed            upsert demo data (keeps AI generation history)
 *   npm run db:seed -- --reset wipe everything first
 */
async function main() {
  loadEnv();
  const sql = createSql(requireDatabaseUrl());
  const reset = process.argv.includes("--reset");
  const seed = buildSeed(new Date());
  try {
    await seedPostgres(sql, seed, { reset });
    if (reset) console.log("reset: all tables truncated first");
    console.log(
      `seeded ${seed.brands.length} brands, ${seed.kbEntries.length} knowledge entries, ` +
        `${seed.customers.length} customers, ${seed.orders.length} orders, ` +
        `${seed.conversations.length} conversations, ${seed.messages.length} messages`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
