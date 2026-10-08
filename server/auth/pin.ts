import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 32;

export const PIN_PATTERN = /^\d{4,8}$/;

export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) throw new Error("PIN must be 4-8 digits");
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(pin, Buffer.from(saltB64, "base64"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash of a session token is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
