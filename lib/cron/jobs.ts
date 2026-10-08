import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendBookingConfirmation } from "@/lib/booking/notifications";
import { buildReminderEmail, cancelUrlFor } from "@/lib/email/booking-emails";
import type { EmailTransport } from "@/lib/email/transport";
import type { Database } from "@/lib/supabase/database.types";

// Scheduled jobs. Each returns counts only (logged and returned by the route);
// no personal data is logged.

type Deps = { db: SupabaseClient<Database>; transport: EmailTransport; appUrl: string };

/** Cheap query so the free Supabase project is not paused for inactivity. */
export async function keepAlive(db: SupabaseClient<Database>): Promise<{ ok: boolean }> {
  const { error } = await db.from("campaigns").select("id", { head: true, count: "exact" }).limit(1);
  if (error) console.error(`[cron] keepalive failed: ${error.code}`);
  return { ok: !error };
}

/** Reminders for tomorrow's (Europe/Sofia) appointments. */
export async function sendReminders({ db, transport, appUrl }: Deps) {
  const { data, error } = await db.rpc("bookings_due_for_reminder", { p_limit: 500 });
  if (error) throw new Error(`bookings_due_for_reminder failed: ${error.code}`);

  let sent = 0;
  let failed = 0;
  for (const row of data) {
    const email = await buildReminderEmail(
      {
        bookingId: row.booking_id,
        fullName: row.full_name,
        email: row.email,
        startsAt: new Date(row.starts_at),
        durationMin: row.duration_min,
        campaignTitle: row.campaign_title,
        locationAddress: row.location_address,
        locationNote: row.location_note,
      },
      row.allow_public_cancel ? cancelUrlFor(appUrl, row.cancel_token) : null,
    );
    const result = await transport(email);
    if (!result.ok) {
      failed++;
      console.error(`[cron] reminder for booking ${row.booking_id} failed: ${result.reason}`);
      continue;
    }
    const { error: updateError } = await db
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.booking_id);
    if (updateError) console.error(`[cron] reminder_sent_at for ${row.booking_id} not saved: ${updateError.code}`);
    sent++;
  }
  return { due: data.length, sent, failed };
}

/** Second chance for confirmations the immediate sender could not deliver. */
export async function retryConfirmations(deps: Deps) {
  const { data, error } = await deps.db.rpc("bookings_needing_confirmation", { p_limit: 200 });
  if (error) throw new Error(`bookings_needing_confirmation failed: ${error.code}`);

  let sent = 0;
  for (const row of data) {
    if (await sendBookingConfirmation(row.booking_id, deps)) sent++;
  }
  return { pending: data.length, sent, failed: data.length - sent };
}

/** GDPR: anonymize bookings older than the retention period. */
export async function anonymizeOldBookings(db: SupabaseClient<Database>, months: number) {
  const { data, error } = await db.rpc("anonymize_old_bookings", { p_months: months });
  if (error) throw new Error(`anonymize_old_bookings failed: ${error.code}`);
  return { anonymized: data };
}
