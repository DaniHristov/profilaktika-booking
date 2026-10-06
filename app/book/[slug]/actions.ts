"use server";

import { headers } from "next/headers";

import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import { getAvailability } from "@/lib/booking/queries";
import { submitBooking } from "@/lib/booking/submit";
import type { BookSlotResult, PublicSlot } from "@/lib/booking/types";
import { getBookingEnv } from "@/lib/env.server";
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
    return await submitBooking(input, turnstileToken, {
      db: createAdminClient(),
      clientIp: getClientIp(await headers()),
      ipHashSecret: env.IP_HASH_SECRET,
      verifyTurnstile: (token, remoteIp) =>
        verifyTurnstileToken(token, { secret: env.TURNSTILE_SECRET_KEY, remoteIp }),
      loadAvailability: () => getAvailability(String(slug)),
    });
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
