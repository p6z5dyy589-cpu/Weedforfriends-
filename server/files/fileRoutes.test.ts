import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { MemoryStore } from "../store/memoryStore";
import { MemoryFileStore } from "./fileStore";
import { hashPin } from "../auth/pin";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
let base = "";
let close: () => void;
const store = new MemoryStore();

async function login(loginName: string): Promise<string> {
  const res = await fetch(`${base}/api/trpc/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { loginName, pin: "1234" } }),
  });
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

const upload = (cookie: string, companyId: number, body: Buffer, requestId = randomUUID()) =>
  fetch(`${base}/api/files`, {
    method: "POST",
    headers: { cookie, "x-request-id": requestId, "x-company-id": String(companyId), "content-type": "image/jpeg" },
    body: new Uint8Array(body),
  });

beforeAll(async () => {
  const pinHash = await hashPin("1234");
  store.addUser({ loginName: "a", displayName: "A", active: true, pinHash, grants: [{ companyId: 1, roles: ["production"] }] });
  store.addUser({ loginName: "x", displayName: "X", active: true, pinHash, grants: [{ companyId: 2, roles: ["production"] }] });
  const server = createApp(store, new MemoryFileStore()).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe("photo upload", () => {
  it("requires a session", async () => {
    expect((await fetch(`${base}/api/files`, { method: "POST", body: new Uint8Array(JPEG) })).status).toBe(401);
  });

  it("stores real images only, bound to the active company", async () => {
    const a = await login("a");
    const x = await login("x");
    expect((await upload(a, 1, Buffer.from("<html>"))).status).toBe(415);
    expect((await upload(a, 2, JPEG)).status).toBe(409);

    const requestId = randomUUID();
    const res = await upload(a, 1, JPEG, requestId);
    expect(res.status).toBe(200);
    const { fileId } = (await res.json()) as { fileId: string };
    // Retry with the same request id returns the same file.
    expect(await (await upload(a, 1, JPEG, requestId)).json()).toEqual({ fileId });

    const own = await fetch(`${base}/api/files/${fileId}`, { headers: { cookie: a } });
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("image/jpeg");
    expect(own.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await fetch(`${base}/api/files/${fileId}`, { headers: { cookie: x } })).status).toBe(404);
  });
});
