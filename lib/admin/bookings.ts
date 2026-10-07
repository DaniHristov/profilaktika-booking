import "server-only";

import { type BookingFilters, BOOKINGS_PAGE_SIZE } from "@/lib/admin/booking-filters";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

// Written out: generated function types do not mark nullable columns.
export type AdminBookingRow = {
  id: string;
  campaign_id: string;
  campaign_title: string;
  slot_id: string;
  starts_at: string;
  duration_min: number;
  full_name: string;
  phone: string;
  email: string;
  workplace: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  confirmation_sent_at: string | null;
};

/** One page of bookings (or all, for the export) matching the filters. */
export async function listBookings(
  filters: BookingFilters,
  { limit = BOOKINGS_PAGE_SIZE, offset = (filters.page - 1) * BOOKINGS_PAGE_SIZE } = {},
): Promise<{ rows: AdminBookingRow[]; total: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_bookings", {
    p_campaign_id: filters.campaignId as string,
    p_date: filters.date as string,
    p_time: filters.time as string,
    p_status: filters.status,
    p_search: filters.q as string,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(`admin_list_bookings failed: ${error.code}`);
  const total = data.length > 0 ? Number(data[0].total_count) : 0;
  return { rows: data.map(({ total_count, ...row }) => row), total };
}

export async function getBooking(id: string): Promise<AdminBookingRow | null> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, campaign_id, slot_id, full_name, phone, email, workplace, notes, status, created_at, confirmation_sent_at, slots(starts_at, duration_min, campaigns(title))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBooking failed: ${error.code}`);
  if (!data || !data.slots) return null;
  return {
    id: data.id,
    campaign_id: data.campaign_id,
    campaign_title: data.slots.campaigns?.title ?? "",
    slot_id: data.slot_id,
    starts_at: data.slots.starts_at,
    duration_min: data.slots.duration_min,
    full_name: data.full_name,
    phone: data.phone,
    email: data.email,
    workplace: data.workplace,
    notes: data.notes,
    status: data.status,
    created_at: data.created_at,
    confirmation_sent_at: data.confirmation_sent_at,
  };
}

export type MoveTarget = { id: string; startsAt: string; free: number };

/** Future, unblocked slots of the campaign with free capacity. */
export async function listMoveTargets(campaignId: string, currentSlotId: string): Promise<MoveTarget[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_slot_stats")
    .select("id, starts_at, capacity, confirmed_count, is_blocked")
    .eq("campaign_id", campaignId)
    .eq("is_blocked", false)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(2000);
  if (error) throw new Error(`listMoveTargets failed: ${error.code}`);
  return (data ?? [])
    .filter((s) => s.id !== currentSlotId && (s.capacity ?? 0) > (s.confirmed_count ?? 0))
    .map((s) => ({
      id: s.id as string,
      startsAt: s.starts_at as string,
      free: (s.capacity ?? 0) - (s.confirmed_count ?? 0),
    }));
}

export async function listCampaignOptions(): Promise<{ id: string; title: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, title, is_active")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCampaignOptions failed: ${error.code}`);
  return data.map((c) => ({ id: c.id, title: c.is_active ? c.title : `${c.title} (неактивна)` }));
}
