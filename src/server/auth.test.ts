import { afterEach, describe, expect, it } from "vitest";

import { createSessionToken, hashPassword, verifyLoginPassword, verifyPassword, verifySessionToken } from "./auth";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("personal auth", () => {
  it("creates and verifies signed session tokens", () => {
    process.env.ALIGNERLOG_AUTH_SECRET = "test-secret-with-more-than-32-characters";

    const token = createSessionToken("00000000-0000-0000-0000-000000000123");

    expect(verifySessionToken(token)).toEqual({
      userId: "00000000-0000-0000-0000-000000000123"
    });
  });

  it("rejects tampered session tokens", () => {
    process.env.ALIGNERLOG_AUTH_SECRET = "test-secret-with-more-than-32-characters";

    const token = createSessionToken("00000000-0000-0000-0000-000000000123");
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000999",
      issuedAt: Math.floor(Date.now() / 1000)
    })).toString("base64url");

    expect(verifySessionToken(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.bad-signature`)).toBeNull();
  });

  it("checks the configured login password", () => {
    process.env.ALIGNERLOG_LOGIN_PASSWORD = "personal-password";

    expect(verifyLoginPassword("personal-password")).toBe(true);
    expect(verifyLoginPassword("wrong-password")).toBe(false);
  });

  it("hashes and verifies registered account passwords", () => {
    const hash = hashPassword("account-password");

    expect(hash).toMatch(/^scrypt\$/u);
    expect(verifyPassword("account-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
