import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Views are typed as all-nullable by the generator; their columns mirror the
// tables (plus counters), so the table row types are used instead.
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"] & {
  upcoming_slots: number;
  upcoming_bookings: number;
};
export type SlotRow = Database["public"]["Tables"]["slots"]["Row"] & {
  confirmed_count: number;
  total_bookings: number;
};

export async function listCampaigns(): Promise<CampaignRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_campaign_stats")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCampaigns failed: ${error.code}`);
  return data as CampaignRow[];
}

/** Cached per request (used by the campaign layout and its pages). */
export const getCampaign = cache(async (id: string): Promise<CampaignRow | null> => {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_campaign_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCampaign failed: ${error.code}`);
  return data as CampaignRow | null;
});

export async function listSlots(campaignId: string, includePast: boolean): Promise<SlotRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("admin_slot_stats")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("starts_at", { ascending: true })
    .limit(2000);
  if (!includePast) query = query.gt("starts_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw new Error(`listSlots failed: ${error.code}`);
  return data as SlotRow[];
}
