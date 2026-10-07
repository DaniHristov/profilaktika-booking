import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { BookingEmailData } from "@/lib/email/booking-emails";
import type { Database } from "@/lib/supabase/database.types";

export type CancelState = "allowed" | "cancelled" | "disabled" | "closed";

/** What the /cancel/[token] page may show. No phone or email. */
export type CancelView = {
  fullName: string;
  startsAt: string;
  durationMin: number;
  campaignTitle: string;
  locationAddress: string;
  locationNote: string | null;
  state: CancelState;
};

export type CancelResult =
  | { status: "cancelled" }
  | { status: "already_cancelled" | "disabled" | "closed" | "not_found" | "error" };

// SQLSTATE codes raised by public.cancel_booking_by_token.
const CANCEL_ERRORS = {
  PB004: "not_found",
  PB005: "already_cancelled",
  PB006: "disabled",
  PB007: "closed",
} as const;

const tokenSchema = z.uuid();

export function isValidCancelToken(token: string): boolean {
  return tokenSchema.safeParse(token).success;
}

export async function getCancelView(
  db: SupabaseClient<Database>,
  token: string,
): Promise<CancelView | null> {
  if (!isValidCancelToken(token)) return null;

  const { data, error } = await db.rpc("get_booking_for_cancel", { p_token: token });
  if (error) {
    throw new Error(`get_booking_for_cancel failed: ${error.code}`);
  }
  const row = data?.[0];
  if (!row) return null;

  return {
    fullName: row.full_name,
    startsAt: new Date(row.starts_at).toISOString(),
    durationMin: row.duration_min,
    campaignTitle: row.campaign_title,
    locationAddress: row.location_address,
    locationNote: row.location_note,
    state: row.cancel_state as CancelState,
  };
}

/**
 * Cancels by token. On success hands the data for the cancellation email to
 * `onCancelled` (the caller sends it after the response).
 */
export async function cancelByToken(
  db: SupabaseClient<Database>,
  token: string,
  onCancelled: (data: BookingEmailData) => void,
): Promise<CancelResult> {
  if (!isValidCancelToken(token)) return { status: "not_found" };

  const { data, error } = await db.rpc("cancel_booking_by_token", { p_token: token });
  if (error) {
    const known = CANCEL_ERRORS[error.code as keyof typeof CANCEL_ERRORS];
    if (known) return { status: known };
    console.error(`[cancel] cancel_booking_by_token failed: ${error.code}`);
    return { status: "error" };
  }

  const row = data?.[0];
  if (!row) {
    console.error("[cancel] cancel_booking_by_token returned no row");
    return { status: "error" };
  }

  onCancelled({
    bookingId: row.booking_id,
    fullName: row.full_name,
    email: row.email,
    startsAt: new Date(row.starts_at),
    durationMin: row.duration_min,
    campaignTitle: row.campaign_title,
    locationAddress: row.location_address,
    locationNote: row.location_note,
  });
  return { status: "cancelled" };
}
