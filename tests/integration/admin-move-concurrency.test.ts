import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Integration tests need the local Supabase keys in .env.local.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error("Integration tests must run against a local Supabase instance only.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(url, serviceRoleKey, options);

// Seeded local admin (supabase/seed.sql).
const ADMIN_EMAIL = "admin@example.invalid";
let admin: SupabaseClient<Database>;

const campaignId = randomUUID();
const slug = `it-mv-${campaignId.slice(0, 8)}`;

async function signInAsAdmin(): Promise<SupabaseClient<Database>> {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL });
  if (error) throw error;
  const client = createClient<Database>(url!, anonKey!, options);
  const verified = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verified.error) throw verified.error;
  return client;
}

async function createSlot(hoursAhead: number, capacity: number) {
  const { data, error } = await service
    .from("slots")
    .insert({
      campaign_id: campaignId,
      starts_at: new Date(Date.now() + hoursAhead * 3_600_000).toISOString(),
      duration_min: 30,
      capacity,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function book(slotId: string, label: string) {
  const { data, error } = await service.rpc("book_slot", {
    p_slot_id: slotId,
    p_full_name: `Тест ${label}`,
    p_phone: "+359888000000",
    p_email: `${label}-${randomUUID()}@test.invalid`,
    p_workplace: "",
    p_notes: "",
  });
  if (error) throw error;
  return data[0].booking_id;
}

beforeAll(async () => {
  admin = await signInAsAdmin();
  const { error } = await service.from("campaigns").insert({
    id: campaignId,
    slug,
    title: "Интеграционен тест: преместване",
    location_address: "Тестов адрес",
  });
  if (error) throw error;
  await Promise.all(Array.from({ length: 20 }, () => service.rpc("get_availability", { p_slug: slug })));
});

afterAll(async () => {
  const { data } = await service.from("bookings").select("id").eq("campaign_id", campaignId);
  const ids = (data ?? []).map((b) => b.id);
  if (ids.length > 0) {
    await service.from("audit_log").delete().in("booking_id", ids);
    await service.from("bookings").delete().in("id", ids);
  }
  await service.from("slots").delete().eq("campaign_id", campaignId);
  await service.from("campaigns").delete().eq("id", campaignId);
  await admin?.auth.signOut();
});

describe("admin_move_booking under concurrency", () => {
  it("a move and public bookings racing for the last seat: exactly one wins", async () => {
    const source = await createSlot(90, 5);
    const target = await createSlot(91, 1);
    const toMove = await book(source, "move");

    const results = await Promise.all([
      admin.rpc("admin_move_booking", { p_booking_id: toMove, p_new_slot_id: target }),
      ...Array.from({ length: 5 }, (_, i) =>
        service.rpc("book_slot", {
          p_slot_id: target,
          p_full_name: `Публичен ${i}`,
          p_phone: "+359888000000",
          p_email: `public-${i}-${randomUUID()}@test.invalid`,
          p_workplace: "",
          p_notes: "",
        }),
      ),
    ]);

    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(new Set(results.flatMap((r) => (r.error ? [r.error.code] : [])))).toEqual(new Set(["PB001"]));

    const { count } = await service
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("slot_id", target)
      .eq("status", "confirmed");
    expect(count).toBe(1);
  });

  it("moves in opposite directions at the same time do not deadlock", async () => {
    const a = await createSlot(92, 2);
    const b = await createSlot(93, 2);
    const fromA = await book(a, "a");
    const fromB = await book(b, "b");

    const results = await Promise.all(
      Array.from({ length: 5 }, () => [
        admin.rpc("admin_move_booking", { p_booking_id: fromA, p_new_slot_id: b }),
        admin.rpc("admin_move_booking", { p_booking_id: fromB, p_new_slot_id: a }),
      ]).flat(),
    );

    // No deadlock (40P01) or unexpected errors; repeats of an already
    // applied move fail cleanly with INVALID_INPUT (same slot).
    const codes = new Set(results.flatMap((r) => (r.error ? [r.error.code] : [])));
    expect(codes.has("40P01")).toBe(false);
    for (const code of codes) expect(["PB103"]).toContain(code);

    const { data } = await service.from("bookings").select("id, slot_id").in("id", [fromA, fromB]);
    const slots = Object.fromEntries((data ?? []).map((r) => [r.id, r.slot_id]));
    expect(slots[fromA]).toBe(b);
    expect(slots[fromB]).toBe(a);
  });
});
