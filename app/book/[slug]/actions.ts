"use server";

import { after } from "next/server";
import { headers } from "next/headers";

import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import { sendBookingConfirmation } from "@/lib/booking/notifications";
import { getAvailability } from "@/lib/booking/queries";
import { submitBooking } from "@/lib/booking/submit";
import type { BookSlotResult, PublicSlot } from "@/lib/booking/types";
import { getEmailTransport } from "@/lib/email/transport";
import { getAppUrl, getBookingEnv } from "@/lib/env.server";
import { getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";

export async function bookSlotAction(
  slug: string,
  input: unknown,
  turnstileToken: unknown,
): Promise<BookSlotResult> {
  try {
    const env = getBookingEnv();
    const db = createAdminClient();
    const result = await submitBooking(input, turnstileToken, {
      db,
      clientIp: getClientIp(await headers()),
      ipHashSecret: env.IP_HASH_SECRET,
      verifyTurnstile: (token, remoteIp) =>
        verifyTurnstileToken(token, { secret: env.TURNSTILE_SECRET_KEY, remoteIp }),
      loadAvailability: () => getAvailability(String(slug)),
    });

    if (result.status === "success") {
      const bookingId = result.confirmation.bookingId;
      // After the response: a slow or failing email provider must not delay or
      // undo the booking. Unsent confirmations are retried in phase 5.
      after(async () => {
        try {
          await sendBookingConfirmation(bookingId, {
            db,
            transport: getEmailTransport(),
            appUrl: getAppUrl(),
          });
        } catch (error) {
          console.error(`[email] confirmation for booking ${bookingId} crashed:`, (error as Error).message);
        }
      });
    }
    return result;
  } catch (error) {
    console.error("[booking] unexpected error:", (error as Error).message);
    return { status: "error", message: BOOKING_MESSAGES.generic };
  }
}

export async function refreshAvailabilityAction(slug: string): Promise<PublicSlot[] | null> {
  try {
    return await getAvailability(String(slug));
  } catch (error) {
    console.error("[booking] refresh failed:", (error as Error).message);
    return null;
  }
}
