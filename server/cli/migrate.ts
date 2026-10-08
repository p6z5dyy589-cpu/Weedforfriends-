/** Applies the generated SQL migrations in ./drizzle. Usage: DATABASE_URL=... pnpm db:migrate */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL fehlt.");
    process.exit(2);
  }
  await migrate(drizzle(url), { migrationsFolder: "./drizzle" });
  console.log("Migrationen angewendet.");
  process.exit(0);
}

main().catch(() => {
  console.error("Migration fehlgeschlagen.");
  process.exit(1);
});
