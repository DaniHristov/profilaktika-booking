import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

// Talks to the local Supabase stack through PostgREST, exactly like the
// server does: every request is its own HTTP call and its own transaction.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Integration tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (local Supabase).",
  );
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error("Integration tests must run against a local Supabase instance only.");
}

const db = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const campaignId = randomUUID();
const slug = `it-${campaignId.slice(0, 8)}`;
const createdSlotIds: string[] = [];

async function createSlot(capacity: number, offsetHours: number) {
  const { data, error } = await db
    .from("slots")
    .insert({
      campaign_id: campaignId,
      starts_at: new Date(Date.now() + offsetHours * 3_600_000).toISOString(),
      duration_min: 30,
      capacity,
    })
    .select("id")
    .single();
  if (error) throw error;
  createdSlotIds.push(data.id);
  return data.id;
}

function book(slotId: string, n: number, email = `person${n}-${randomUUID()}@test.invalid`) {
  return db.rpc("book_slot", {
    p_slot_id: slotId,
    p_full_name: `Тест Човек ${n}`,
    p_phone: "+359888000000",
    p_email: email,
    p_workplace: "",
    p_notes: "",
  });
}

function tally(results: Awaited<ReturnType<typeof book>>[]) {
  const ok = results.filter((r) => !r.error).length;
  const codes = results.flatMap((r) => (r.error ? [r.error.code] : []));
  return { ok, codes };
}

beforeAll(async () => {
  const { error } = await db.from("campaigns").insert({
    id: campaignId,
    slug,
    title: "Интеграционен тест",
    location_address: "Тестов адрес",
  });
  if (error) throw error;

  // Warm up PostgREST's connection pool so the parallel requests below are
  // really handled concurrently instead of queuing behind connection setup.
  await Promise.all(
    Array.from({ length: 20 }, () => db.rpc("get_availability", { p_slug: slug })),
  );
});

afterAll(async () => {
  const { data: bookings } = await db
    .from("bookings")
    .select("id")
    .eq("campaign_id", campaignId);
  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length > 0) {
    await db.from("audit_log").delete().in("booking_id", bookingIds);
    await db.from("bookings").delete().in("id", bookingIds);
  }
  if (createdSlotIds.length > 0) {
    await db.from("slots").delete().in("id", createdSlotIds);
  }
  await db.from("campaigns").delete().eq("id", campaignId);
});

describe("book_slot under concurrency", () => {
  it("20 parallel requests for a slot with capacity 1 give exactly 1 booking", async () => {
    const slotId = await createSlot(1, 72);

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => book(slotId, i)),
    );

    const { ok, codes } = tally(results);
    expect(ok).toBe(1);
    expect(codes).toHaveLength(19);
    expect(new Set(codes)).toEqual(new Set(["PB001"]));

    const { count } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("slot_id", slotId)
      .eq("status", "confirmed");
    expect(count).toBe(1);
  });

  it("20 parallel requests for a slot with capacity 3 give exactly 3 bookings", async () => {
    const slotId = await createSlot(3, 73);

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => book(slotId, 100 + i)),
    );

    const { ok, codes } = tally(results);
    expect(ok).toBe(3);
    expect(new Set(codes)).toEqual(new Set(["PB001"]));
  });

  it("the same email booking two different slots at once gets exactly 1 booking", async () => {
    const slotA = await createSlot(5, 74);
    const slotB = await createSlot(5, 75);
    const email = `same-${randomUUID()}@test.invalid`;

    const results = await Promise.all([
      book(slotA, 200, email),
      book(slotB, 201, email.toUpperCase()),
    ]);

    const { ok, codes } = tally(results);
    expect(ok).toBe(1);
    expect(codes).toEqual(["PB002"]);
  });
});
