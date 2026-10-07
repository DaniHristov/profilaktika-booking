import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Integration tests need the local Supabase keys in .env.local.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error("Integration tests must run against a local Supabase instance only.");
}

const db = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const campaignId = randomUUID();
const slug = `it-cx-${campaignId.slice(0, 8)}`;
let slotId = "";

beforeAll(async () => {
  const campaign = await db.from("campaigns").insert({
    id: campaignId,
    slug,
    title: "Интеграционен тест: отмяна",
    location_address: "Тестов адрес",
  });
  if (campaign.error) throw campaign.error;

  const slot = await db
    .from("slots")
    .insert({
      campaign_id: campaignId,
      starts_at: new Date(Date.now() + 80 * 3_600_000).toISOString(),
      duration_min: 30,
      capacity: 1,
    })
    .select("id")
    .single();
  if (slot.error) throw slot.error;
  slotId = slot.data.id;

  // Warm up PostgREST's connection pool (see book-slot-concurrency.test.ts).
  await Promise.all(Array.from({ length: 20 }, () => db.rpc("get_availability", { p_slug: slug })));
});

afterAll(async () => {
  const { data: bookings } = await db.from("bookings").select("id").eq("campaign_id", campaignId);
  const ids = (bookings ?? []).map((b) => b.id);
  if (ids.length > 0) {
    await db.from("audit_log").delete().in("booking_id", ids);
    await db.from("bookings").delete().in("id", ids);
  }
  await db.from("slots").delete().eq("campaign_id", campaignId);
  await db.from("campaigns").delete().eq("id", campaignId);
});

describe("cancel_booking_by_token under concurrency", () => {
  it("10 parallel cancellations succeed exactly once and free the slot", async () => {
    const booked = await db.rpc("book_slot", {
      p_slot_id: slotId,
      p_full_name: "Тест Отмяна",
      p_phone: "+359888000000",
      p_email: `cancel-${randomUUID()}@test.invalid`,
      p_workplace: "",
      p_notes: "",
    });
    if (booked.error) throw booked.error;
    const token = booked.data[0].cancel_token;

    const before = await db.rpc("get_availability", { p_slug: slug });
    expect(before.data?.[0].available_count).toBe(0);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => db.rpc("cancel_booking_by_token", { p_token: token })),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(new Set(results.flatMap((r) => (r.error ? [r.error.code] : [])))).toEqual(
      new Set(["PB005"]),
    );

    const audit = await db
      .from("audit_log")
      .select("action")
      .eq("booking_id", booked.data[0].booking_id)
      .eq("action", "cancel");
    expect(audit.data).toHaveLength(1);

    const after = await db.rpc("get_availability", { p_slug: slug });
    expect(after.data?.[0].available_count).toBe(1);
  });
});
