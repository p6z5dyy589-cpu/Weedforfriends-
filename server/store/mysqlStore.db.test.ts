import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { sql } from "drizzle-orm";
import { MySqlStore } from "./mysqlStore";
import { storeContract } from "./storeContract";

/**
 * Runs only via `pnpm test:db` against a disposable test database
 * (TEST_DATABASE_URL). Never point this at the production database.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL fehlt (nur Wegwerf-Testdatenbank).");
if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL muss eine Testdatenbank sein (Name enthält 'test').");

storeContract("mysql", async () => {
  const db = drizzle(url);
  for (const t of ["local_requests", "local_events", "local_records", "kiosk_sessions", "kiosk_user_companies", "kiosk_users", "__drizzle_migrations"]) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS \`${t}\``));
  }
  await migrate(db, { migrationsFolder: "./drizzle" });
  return new MySqlStore(db);
});
