import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./pin";
import { AttemptLimiter } from "./rateLimit";

describe("PIN hashing", () => {
  it("verifies the right PIN and rejects others", async () => {
    const h = await hashPin("4711");
    expect(h).not.toContain("4711");
    expect(await verifyPin("4711", h)).toBe(true);
    expect(await verifyPin("4712", h)).toBe(false);
    expect(await verifyPin("4711", "garbage")).toBe(false);
  });

  it("refuses to hash non-numeric or short PINs", async () => {
    await expect(hashPin("12")).rejects.toThrow();
    await expect(hashPin("abcd")).rejects.toThrow();
  });
});

describe("AttemptLimiter", () => {
  it("blocks after max failures and resets after the window", () => {
    let t = 0;
    const l = new AttemptLimiter(2, 100, () => t);
    l.recordFailure("k");
    expect(l.isBlocked("k")).toBe(false);
    l.recordFailure("k");
    expect(l.isBlocked("k")).toBe(true);
    expect(l.isBlocked("other")).toBe(false);
    t = 100;
    expect(l.isBlocked("k")).toBe(false);
  });
});
