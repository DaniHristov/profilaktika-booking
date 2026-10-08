import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { cronHandler, retentionMonths } from "@/lib/cron/handler";
import { anonymizeOldBookings, sendReminders } from "@/lib/cron/jobs";
import type { EmailMessage, EmailTransport } from "@/lib/email/transport";
import type { Database } from "@/lib/supabase/database.types";

const SECRET = "s3cret-value-for-tests-1234";

describe("isAuthorizedCronRequest", () => {
  it("accepts only the exact bearer token", () => {
    expect(isAuthorizedCronRequest(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(new Headers({ authorization: `Bearer ${SECRET}x` }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(new Headers({ authorization: SECRET }), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(new Headers(), SECRET)).toBe(false);
  });

  it("refuses everything when the secret is missing or too short", () => {
    expect(isAuthorizedCronRequest(new Headers({ authorization: "Bearer " }), "")).toBe(false);
    expect(isAuthorizedCronRequest(new Headers({ authorization: "Bearer short" }), "short")).toBe(false);
    expect(isAuthorizedCronRequest(new Headers({ authorization: "Bearer undefined" }), undefined)).toBe(false);
  });
});

describe("cronHandler", () => {
  it("returns 401 without running the job", async () => {
    const job = vi.fn(async () => ({}));
    const response = await cronHandler("x", job)(new Request("http://localhost/api/cron/x"));
    expect(response.status).toBe(401);
    expect(job).not.toHaveBeenCalled();
  });

  it("returns the counts on success and a generic error on failure", async () => {
    process.env.CRON_SECRET = SECRET;
    const request = () => new Request("http://localhost/api/cron/x", { headers: { authorization: `Bearer ${SECRET}` } });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const ok = await cronHandler("x", async () => ({ sent: 2 }))(request());
    expect(await ok.json()).toEqual({ job: "x", sent: 2 });

    const failed = await cronHandler("x", async () => {
      throw new Error("db down");
    })(request());
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ job: "x", error: "failed" });

    info.mockRestore();
    error.mockRestore();
    delete process.env.CRON_SECRET;
  });
});

describe("retentionMonths", () => {
  it("defaults to 12 and rejects nonsense", () => {
    expect(retentionMonths(undefined)).toBe(12);
    expect(retentionMonths("24")).toBe(24);
    expect(retentionMonths("0")).toBe(12);
    expect(retentionMonths("abc")).toBe(12);
    expect(retentionMonths("1.5")).toBe(12);
  });
});

const dueRow = {
  booking_id: "b0000000-0000-0000-0000-000000000001",
  full_name: "Мария Петрова",
  email: "maria@example.invalid",
  cancel_token: "c0000000-0000-0000-0000-000000000001",
  starts_at: "2026-10-15T06:00:00+00:00",
  duration_min: 30,
  campaign_title: "Кампания",
  location_address: "Адрес",
  location_note: null,
  allow_public_cancel: true,
};

function fakeDb(rows: unknown[]) {
  const updates: unknown[] = [];
  const db = {
    rpc: vi.fn(async () => ({ data: rows, error: null })),
    from: vi.fn(() => ({
      update: (values: unknown) => ({
        eq: async () => {
          updates.push(values);
          return { error: null };
        },
      }),
    })),
  };
  return { db: db as unknown as SupabaseClient<Database>, updates, rpc: db.rpc };
}

describe("sendReminders", () => {
  it("sends one reminder per due booking and marks it sent", async () => {
    const { db, updates } = fakeDb([dueRow]);
    const sentMessages: EmailMessage[] = [];
    const transport: EmailTransport = async (m) => {
      sentMessages.push(m);
      return { ok: true, id: "1" };
    };

    expect(await sendReminders({ db, transport, appUrl: "https://zapis.example.bg" })).toEqual({ due: 1, sent: 1, failed: 0 });
    expect(sentMessages[0].subject).toBe("Напомняне: профилактичен преглед утре, 15.10.2026 от 09:00");
    expect(sentMessages[0].text).toContain("https://zapis.example.bg/cancel/c0000000-0000-0000-0000-000000000001");
    expect(updates).toHaveLength(1);
  });

  it("does not mark failed reminders as sent and logs only ids", async () => {
    const { db, updates } = fakeDb([dueRow, { ...dueRow, booking_id: "b2", allow_public_cancel: false }]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport: EmailTransport = async () => ({ ok: false, reason: "resend_http_403" });

    expect(await sendReminders({ db, transport, appUrl: "https://x.bg" })).toEqual({ due: 2, sent: 0, failed: 2 });
    expect(updates).toHaveLength(0);
    expect(JSON.stringify(error.mock.calls)).not.toContain("maria@example.invalid");
    error.mockRestore();
  });
});

describe("anonymizeOldBookings", () => {
  it("passes the retention period and returns the count", async () => {
    const { db, rpc } = fakeDb([]);
    rpc.mockResolvedValueOnce({ data: 3, error: null } as never);
    expect(await anonymizeOldBookings(db, 12)).toEqual({ anonymized: 3 });
    expect(rpc).toHaveBeenCalledWith("anonymize_old_bookings", { p_months: 12 });
  });
});
