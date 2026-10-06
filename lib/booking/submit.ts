import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import type { BookSlotResult, PublicSlot } from "@/lib/booking/types";
import { RATE_LIMITS, checkRateLimit, hashIp } from "@/lib/rate-limit";
import type { Database } from "@/lib/supabase/database.types";
import type { BookingField } from "@/lib/validation/booking";
import { bookingServerSchema } from "@/lib/validation/booking.server";

// SQLSTATE codes raised by public.book_slot (see the migration).
const BOOK_SLOT_ERRORS = {
  PB001: "slot_full",
  PB002: "duplicate_email",
  PB003: "closed",
} as const;

export type SubmitBookingDeps = {
  /** Service-role client: book_slot and check_rate_limit are service_role only. */
  db: SupabaseClient<Database>;
  clientIp: string;
  ipHashSecret: string;
  verifyTurnstile: (token: string, remoteIp: string) => Promise<boolean>;
  loadAvailability: () => Promise<PublicSlot[]>;
};

/**
 * Server-side booking flow:
 * attempt rate limit → validation → Turnstile → success rate limit → book_slot.
 * Never logs personal data.
 */
export async function submitBooking(
  input: unknown,
  turnstileToken: unknown,
  deps: SubmitBookingDeps,
): Promise<BookSlotResult> {
  const ipHash = hashIp(deps.clientIp, deps.ipHashSecret);

  if (!(await checkRateLimit(deps.db, ipHash, RATE_LIMITS.bookingAttempt))) {
    return { status: "rate_limited", message: BOOKING_MESSAGES.rateLimited };
  }

  const parsed = bookingServerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BookingField, string>> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      const first = (messages as string[] | undefined)?.[0];
      if (first) fieldErrors[field as BookingField] = first;
    }
    return { status: "invalid", fieldErrors };
  }

  const token = typeof turnstileToken === "string" ? turnstileToken : "";
  if (!(await deps.verifyTurnstile(token, deps.clientIp))) {
    return { status: "captcha_failed", message: BOOKING_MESSAGES.captchaFailed };
  }

  if (!(await checkRateLimit(deps.db, ipHash, RATE_LIMITS.bookingSuccess, false))) {
    return { status: "rate_limited", message: BOOKING_MESSAGES.rateLimited };
  }

  const form = parsed.data;
  const { data, error } = await deps.db.rpc("book_slot", {
    p_slot_id: form.slotId,
    p_full_name: form.fullName,
    p_phone: form.phone,
    p_email: form.email,
    p_workplace: form.workplace ?? "",
    p_notes: form.notes ?? "",
  });

  if (error) {
    const known = BOOK_SLOT_ERRORS[error.code as keyof typeof BOOK_SLOT_ERRORS];
    if (known === "slot_full" || known === "closed") {
      return {
        status: known,
        message: known === "slot_full" ? BOOKING_MESSAGES.slotFull : BOOKING_MESSAGES.closed,
        slots: await deps.loadAvailability(),
      };
    }
    if (known === "duplicate_email") {
      return { status: "duplicate_email", message: BOOKING_MESSAGES.duplicateEmail };
    }
    // Only the error code: details may echo submitted values.
    console.error(`[booking] book_slot failed: ${error.code}`);
    return { status: "error", message: BOOKING_MESSAGES.generic };
  }

  const booking = data?.[0];
  if (!booking) {
    console.error("[booking] book_slot returned no row");
    return { status: "error", message: BOOKING_MESSAGES.generic };
  }

  await checkRateLimit(deps.db, ipHash, RATE_LIMITS.bookingSuccess, true);

  return {
    status: "success",
    confirmation: {
      bookingId: booking.booking_id,
      startsAt: new Date(booking.starts_at).toISOString(),
      durationMin: booking.duration_min,
      title: booking.campaign_title,
      locationAddress: booking.location_address,
      locationNote: booking.location_note,
    },
  };
}
