import "server-only";

import type { PublicCampaign, PublicSlot } from "@/lib/booking/types";
import { createPublicClient } from "@/lib/supabase/public";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length <= 80 && SLUG_PATTERN.test(slug);
}

/** Returns null for an unknown campaign. */
export async function getPublicCampaign(slug: string): Promise<PublicCampaign | null> {
  if (!isValidSlug(slug)) return null;

  const { data, error } = await createPublicClient().rpc("get_campaign_public", {
    p_slug: slug,
  });
  if (error) {
    throw new Error(`get_campaign_public failed: ${error.code}`);
  }

  const row = data?.[0];
  if (!row) return null;
  return {
    title: row.title,
    locationAddress: row.location_address,
    locationNote: row.location_note,
    isActive: row.is_active,
  };
}

/** Bookable slots (including full ones, marked unavailable), sorted by time. */
export async function getAvailability(slug: string): Promise<PublicSlot[]> {
  if (!isValidSlug(slug)) return [];

  const { data, error } = await createPublicClient().rpc("get_availability", {
    p_slug: slug,
  });
  if (error) {
    throw new Error(`get_availability failed: ${error.code}`);
  }

  return (data ?? []).map((row) => ({
    id: row.slot_id,
    startsAt: new Date(row.starts_at).toISOString(),
    durationMin: row.duration_min,
    available: row.available_count > 0,
  }));
}
