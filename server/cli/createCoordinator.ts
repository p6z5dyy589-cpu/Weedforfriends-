/**
 * Creates the first coordinator so somebody can log in and manage people in
 * the app. Usage:
 *   DATABASE_URL=... pnpm admin:create-coordinator --login vincent --name "Vincent" --companies 1,2
 * The PIN is read from stdin (hidden on a terminal) and never printed.
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { drizzle } from "drizzle-orm/mysql2";
import { isCompanyId, type CompanyId } from "@shared/companies";
import { MySqlStore } from "../store/mysqlStore";
import { hashPin, PIN_PATTERN } from "../auth/pin";
import { LoginNameTakenError, NEW_USER_ID } from "../store/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function readPin(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    // Hide typed characters.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes("PIN")) process.stdout.write(s);
    };
  }
  const pin = await new Promise<string>((resolve) => rl.question("PIN (4-8 Ziffern): ", resolve));
  rl.close();
  process.stdout.write("\n");
  return pin.trim();
}

async function main() {
  const url = process.env.DATABASE_URL;
  const loginName = arg("login");
  const displayName = arg("name");
  const companies = (arg("companies") ?? "").split(",").map(Number).filter(isCompanyId) as CompanyId[];
  if (!url || !loginName || !displayName || companies.length === 0) {
    console.error('Aufruf: DATABASE_URL=... pnpm admin:create-coordinator --login <kürzel> --name "<Name>" --companies 1,2');
    process.exit(2);
  }
  const pin = await readPin();
  if (!PIN_PATTERN.test(pin)) {
    console.error("PIN muss aus 4-8 Ziffern bestehen.");
    process.exit(2);
  }
  const store = new MySqlStore(drizzle(url));
  try {
    const out = await store.commit({
      companyId: companies[0]!,
      request: null,
      users: [{ type: "create", loginName, displayName, pinHash: await hashPin(pin), grants: companies.map((companyId) => ({ companyId, roles: ["coordinator"] })) }],
      events: companies.map((companyId) => ({
        id: randomUUID(),
        companyId,
        subject: "person" as const,
        subjectId: NEW_USER_ID,
        type: "created_by_cli",
        actorUserId: 0,
        requestId: null,
        payload: { roles: ["coordinator"] },
        createdAt: new Date(),
      })),
    });
    console.log(`Koordinator angelegt (ID ${out.newUserId}).`);
    process.exit(0);
  } catch (e) {
    if (e instanceof LoginNameTakenError) console.error("Dieses Kürzel ist bereits vergeben.");
    else console.error("Anlegen fehlgeschlagen.");
    process.exit(1);
  }
}

void main();
