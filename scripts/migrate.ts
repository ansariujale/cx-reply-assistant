import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSql } from "../src/lib/store/postgres";
import { loadEnv, requireDatabaseUrl } from "./env";

/**
 * Applies supabase/migrations/*.sql in filename order, once each, tracked in
 * schema_migrations. Idempotent: safe to run on every deploy.
 */
async function main() {
  loadEnv();
  const sql = createSql(requireDatabaseUrl());
  try {
    await sql`create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
    const applied = new Set((await sql`select name from schema_migrations`).map((r) => String(r.name)));
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file}`);
        continue;
      }
      const text = readFileSync(join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      console.log(`applied ${file}`);
    }
    console.log("migrations up to date");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
