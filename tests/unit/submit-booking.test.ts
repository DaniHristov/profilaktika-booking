import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import { submitBooking, type SubmitBookingDeps } from "@/lib/booking/submit";
import type { Database } from "@/lib/supabase/database.types";

type RpcResult = { data: unknown; error: { code: string; message: string } | null };

const validInput = {
  slotId: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a",
  fullName: "  Иван   Иванов ",
  phone: "0888 123 456",
  email: "Ivan@Example.com",
  workplace: "",
  notes: "",
  consent: true,
};

const bookedRow = {
  booking_id: "b0000000-0000-0000-0000-000000000001",
  cancel_token: "c0000000-0000-0000-0000-000000000001",
  starts_at: "2026-10-15T06:00:00+00:00",
  duration_min: 30,
  campaign_title: "Кампания",
  location_address: "Адрес",
  location_note: null,
};

function setup({
  rateLimit = () => true,
  bookSlot = (): RpcResult => ({ data: [bookedRow], error: null }),
  turnstile = true,
}: {
  rateLimit?: (args: Record<string, unknown>) => boolean;
  bookSlot?: () => RpcResult;
  turnstile?: boolean;
} = {}) {
  const calls: string[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "check_rate_limit") {
      calls.push(`rate:${args.p_kind}:${args.p_record}`);
      return { data: rateLimit(args), error: null };
    }
    if (fn === "book_slot") {
      calls.push("book_slot");
      return bookSlot();
    }
    throw new Error(`unexpected rpc ${fn}`);
  });
  const deps: SubmitBookingDeps = {
    db: { rpc } as unknown as SupabaseClient<Database>,
    clientIp: "203.0.113.7",
    ipHashSecret: "s".repeat(32),
    verifyTurnstile: vi.fn(async () => {
      calls.push("turnstile");
      return turnstile;
    }),
    loadAvailability: vi.fn(async () => [
      { id: "x", startsAt: "2026-10-15T06:30:00.000Z", durationMin: 30, available: true },
    ]),
  };
  return { deps, rpc, calls };
}

describe("submitBooking", () => {
  it("runs the checks in order and books with normalized data", async () => {
    const { deps, rpc, calls } = setup();

    const result = await submitBooking(validInput, "token", deps);

    expect(calls).toEqual([
      "rate:booking_attempt:true",
      "turnstile",
      "rate:booking_success:false",
      "book_slot",
      "rate:booking_success:true",
    ]);
    expect(rpc).toHaveBeenCalledWith("book_slot", {
      p_slot_id: validInput.slotId,
      p_full_name: "Иван Иванов",
      p_phone: "+359888123456",
      p_email: "ivan@example.com",
      p_workplace: "",
      p_notes: "",
    });
    expect(result).toEqual({
      status: "success",
      confirmation: {
        bookingId: bookedRow.booking_id,
        startsAt: "2026-10-15T06:00:00.000Z",
        durationMin: 30,
        title: "Кампания",
        locationAddress: "Адрес",
        locationNote: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain(bookedRow.cancel_token);
  });

  it("never sends the raw IP to the database", async () => {
    const { deps, rpc } = setup();
    await submitBooking(validInput, "token", deps);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.7");
  });

  it("stops at the attempt rate limit before validation and Turnstile", async () => {
    const { deps, calls } = setup({ rateLimit: () => false });
    const result = await submitBooking(validInput, "token", deps);
    expect(result).toEqual({ status: "rate_limited", message: BOOKING_MESSAGES.rateLimited });
    expect(calls).toEqual(["rate:booking_attempt:true"]);
  });

  it("returns field errors without calling Turnstile or book_slot", async () => {
    const { deps, calls } = setup();
    const result = await submitBooking({ ...validInput, phone: "123", consent: false }, "t", deps);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["consent", "phone"]);
    }
    expect(calls).toEqual(["rate:booking_attempt:true"]);
  });

  it("refuses when Turnstile fails", async () => {
    const { deps, calls } = setup({ turnstile: false });
    const result = await submitBooking(validInput, "t", deps);
    expect(result).toEqual({ status: "captcha_failed", message: BOOKING_MESSAGES.captchaFailed });
    expect(calls).not.toContain("book_slot");
  });

  it("refuses when the success limit is reached", async () => {
    const { deps, calls } = setup({ rateLimit: (args) => args.p_kind === "booking_attempt" });
    const result = await submitBooking(validInput, "t", deps);
    expect(result.status).toBe("rate_limited");
    expect(calls).not.toContain("book_slot");
  });

  it.each([
    ["PB001", "slot_full", BOOKING_MESSAGES.slotFull],
    ["PB003", "closed", BOOKING_MESSAGES.closed],
  ])("maps %s to %s and returns fresh availability", async (code, status, message) => {
    const { deps, calls } = setup({
      bookSlot: () => ({ data: null, error: { code, message: "x" } }),
    });
    const result = await submitBooking(validInput, "t", deps);
    expect(result).toMatchObject({ status, message });
    if (result.status === "slot_full" || result.status === "closed") {
      expect(result.slots).toHaveLength(1);
    }
    expect(calls).not.toContain("rate:booking_success:true");
  });

  it("maps PB002 to duplicate_email", async () => {
    const { deps } = setup({
      bookSlot: () => ({ data: null, error: { code: "PB002", message: "DUPLICATE_EMAIL" } }),
    });
    expect(await submitBooking(validInput, "t", deps)).toEqual({
      status: "duplicate_email",
      message: BOOKING_MESSAGES.duplicateEmail,
    });
  });

  it("logs only the error code for unexpected database errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({
      bookSlot: () => ({
        data: null,
        error: { code: "23514", message: "violates check, value ivan@example.com" },
      }),
    });
    const result = await submitBooking(validInput, "t", deps);
    expect(result).toEqual({ status: "error", message: BOOKING_MESSAGES.generic });
    expect(JSON.stringify(log.mock.calls)).not.toContain("ivan@example.com");
    log.mockRestore();
  });
});
