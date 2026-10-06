import { describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "@/lib/turnstile/verify";

const TEST_SECRET = "1x0000000000000000000000000000000AA";

function fakeFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

describe("verifyTurnstileToken", () => {
  it("returns true when Cloudflare reports success and sends secret, token and IP", async () => {
    const fetchImpl = fakeFetch(Response.json({ success: true }));

    const ok = await verifyTurnstileToken("token-123", {
      secret: TEST_SECRET,
      remoteIp: "203.0.113.5",
      isProduction: false,
      fetchImpl,
    });

    expect(ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0];
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe(TEST_SECRET);
    expect(body.get("response")).toBe("token-123");
    expect(body.get("remoteip")).toBe("203.0.113.5");
  });

  it("returns false when Cloudflare reports failure", async () => {
    const ok = await verifyTurnstileToken("t", {
      secret: TEST_SECRET,
      isProduction: false,
      fetchImpl: fakeFetch(Response.json({ success: false, "error-codes": ["invalid-input-response"] })),
    });
    expect(ok).toBe(false);
  });

  it("fails closed on network errors and HTTP errors", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await verifyTurnstileToken("t", {
        secret: TEST_SECRET,
        isProduction: false,
        fetchImpl: fakeFetch(new TypeError("network down")),
      }),
    ).toBe(false);
    expect(
      await verifyTurnstileToken("t", {
        secret: TEST_SECRET,
        isProduction: false,
        fetchImpl: fakeFetch(new Response("oops", { status: 500 })),
      }),
    ).toBe(false);
    silence.mockRestore();
  });

  it("rejects empty tokens without calling Cloudflare", async () => {
    const fetchImpl = fakeFetch(Response.json({ success: true }));
    expect(
      await verifyTurnstileToken("", { secret: TEST_SECRET, isProduction: false, fetchImpl }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses Cloudflare test secrets in production", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = fakeFetch(Response.json({ success: true }));
    expect(
      await verifyTurnstileToken("t", { secret: TEST_SECRET, isProduction: true, fetchImpl }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    silence.mockRestore();
  });
});
