import { describe, expect, it } from "vitest";

import { getClientIp, hashIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("uses x-real-ip (set by Vercel)", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores a spoofable x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
      "x-real-ip": "203.0.113.7",
    });
    expect(getClientIp(headers)).toBe("203.0.113.7");
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("127.0.0.1");
  });

  it("falls back locally when the header is missing or empty", () => {
    expect(getClientIp(new Headers())).toBe("127.0.0.1");
    expect(getClientIp(new Headers({ "x-real-ip": "  " }))).toBe("127.0.0.1");
  });
});

describe("hashIp", () => {
  const secret = "x".repeat(32);

  it("returns a 64-char hex HMAC that does not contain the IP", () => {
    const hash = hashIp("203.0.113.7", secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203");
  });

  it("is stable per secret and differs across secrets", () => {
    expect(hashIp("203.0.113.7", secret)).toBe(hashIp("203.0.113.7", secret));
    expect(hashIp("203.0.113.7", secret)).not.toBe(hashIp("203.0.113.7", "y".repeat(32)));
  });
});
