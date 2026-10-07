import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { cancelByToken, getCancelView } from "@/lib/booking/cancel";
import type { Database } from "@/lib/supabase/database.types";

// Real tokens are v4 UUIDs from gen_random_uuid().
const TOKEN = "3f2b8c1e-7d4a-4e6b-9c0d-1a2b3c4d5e6f";

function fakeDb(result: { data: unknown; error: { code: string } | null }) {
  const rpc = vi.fn(async () => result);
  return { db: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const cancelledRow = {
  booking_id: "b0000000-0000-0000-0000-000000000001",
  full_name: "Мария Петрова",
  email: "maria@example.invalid",
  starts_at: "2026-10-15T06:00:00+00:00",
  duration_min: 30,
  campaign_title: "Кампания",
  location_address: "Адрес",
  location_note: null,
};

describe("cancelByToken", () => {
  it("rejects malformed tokens without touching the database", async () => {
    const { db, rpc } = fakeDb({ data: null, error: null });
    expect(await cancelByToken(db, "not-a-uuid", vi.fn())).toEqual({ status: "not_found" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cancels and hands over the email data", async () => {
    const { db, rpc } = fakeDb({ data: [cancelledRow], error: null });
    const onCancelled = vi.fn();

    expect(await cancelByToken(db, TOKEN, onCancelled)).toEqual({ status: "cancelled" });
    expect(rpc).toHaveBeenCalledWith("cancel_booking_by_token", { p_token: TOKEN });
    expect(onCancelled).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: cancelledRow.booking_id,
        email: "maria@example.invalid",
        startsAt: new Date("2026-10-15T06:00:00Z"),
      }),
    );
  });

  it.each([
    ["PB004", "not_found"],
    ["PB005", "already_cancelled"],
    ["PB006", "disabled"],
    ["PB007", "closed"],
  ])("maps %s to %s without sending an email", async (code, status) => {
    const { db } = fakeDb({ data: null, error: { code } });
    const onCancelled = vi.fn();
    expect(await cancelByToken(db, TOKEN, onCancelled)).toEqual({ status });
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("returns a generic error for unknown database errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ data: null, error: { code: "XX000" } });
    expect(await cancelByToken(db, TOKEN, vi.fn())).toEqual({ status: "error" });
    log.mockRestore();
  });
});

describe("getCancelView", () => {
  it("returns null for malformed or unknown tokens", async () => {
    expect(await getCancelView(fakeDb({ data: [], error: null }).db, "x")).toBeNull();
    expect(await getCancelView(fakeDb({ data: [], error: null }).db, TOKEN)).toBeNull();
  });

  it("maps the row and exposes no contact data", async () => {
    const { db } = fakeDb({
      data: [
        {
          full_name: "Мария Петрова",
          starts_at: "2026-10-15T06:00:00+00:00",
          duration_min: 30,
          campaign_title: "Кампания",
          location_address: "Адрес",
          location_note: "Етаж 2",
          cancel_state: "allowed",
        },
      ],
      error: null,
    });
    const view = await getCancelView(db, TOKEN);
    expect(view).toEqual({
      fullName: "Мария Петрова",
      startsAt: "2026-10-15T06:00:00.000Z",
      durationMin: 30,
      campaignTitle: "Кампания",
      locationAddress: "Адрес",
      locationNote: "Етаж 2",
      state: "allowed",
    });
  });
});
