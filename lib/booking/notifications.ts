import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildCancellationEmail,
  buildConfirmationEmail,
  buildMovedEmail,
  cancelUrlFor,
  type BookingEmailData,
} from "@/lib/email/booking-emails";
import type { EmailTransport } from "@/lib/email/transport";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Sends the confirmation email for a booking and records confirmation_sent_at.
 * Loads everything by id so the phase 5 retry job can reuse it. Returns false
 * on failure; logs only ids and error codes.
 */
export async function sendBookingConfirmation(
  bookingId: string,
  deps: { db: SupabaseClient<Database>; transport: EmailTransport; appUrl: string },
): Promise<boolean> {
  const { data: booking, error } = await deps.db
    .from("bookings")
    .select(
      "id, full_name, email, status, cancel_token, confirmation_sent_at, slots(starts_at, duration_min, campaigns(title, location_address, location_note, allow_public_cancel))",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking || !booking.slots?.campaigns) {
    console.error(`[email] confirmation: booking ${bookingId} not loaded (${error?.code ?? "missing"})`);
    return false;
  }
  if (booking.status !== "confirmed" || booking.confirmation_sent_at) {
    return true;
  }

  const slot = booking.slots;
  const campaign = slot.campaigns;
  const data: BookingEmailData = {
    bookingId: booking.id,
    fullName: booking.full_name,
    email: booking.email,
    startsAt: new Date(slot.starts_at),
    durationMin: slot.duration_min,
    campaignTitle: campaign.title,
    locationAddress: campaign.location_address,
    locationNote: campaign.location_note,
  };
  const cancelUrl = campaign.allow_public_cancel
    ? cancelUrlFor(deps.appUrl, booking.cancel_token)
    : null;

  const result = await deps.transport(await buildConfirmationEmail(data, cancelUrl));
  if (!result.ok) {
    console.error(`[email] confirmation for booking ${bookingId} failed: ${result.reason}`);
    return false;
  }

  const { error: updateError } = await deps.db
    .from("bookings")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (updateError) {
    console.error(`[email] confirmation_sent_at for booking ${bookingId} not saved: ${updateError.code}`);
  }
  return true;
}

/** Sends the cancellation email. Returns false on failure. */
export async function sendCancellationEmail(
  data: BookingEmailData,
  deps: { transport: EmailTransport },
): Promise<boolean> {
  const result = await deps.transport(await buildCancellationEmail(data));
  if (!result.ok) {
    console.error(`[email] cancellation for booking ${data.bookingId} failed: ${result.reason}`);
    return false;
  }
  return true;
}

/** Sends the "time changed" email after an admin move. Returns false on failure. */
export async function sendMovedEmail(
  data: BookingEmailData,
  cancelUrl: string | null,
  deps: { transport: EmailTransport },
): Promise<boolean> {
  const result = await deps.transport(await buildMovedEmail(data, cancelUrl));
  if (!result.ok) {
    console.error(`[email] move notice for booking ${data.bookingId} failed: ${result.reason}`);
    return false;
  }
  return true;
}
