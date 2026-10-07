"use server";

import { after } from "next/server";

import { cancelByToken, type CancelResult } from "@/lib/booking/cancel";
import { sendCancellationEmail } from "@/lib/booking/notifications";
import type { BookingEmailData } from "@/lib/email/booking-emails";
import { getEmailTransport } from "@/lib/email/transport";
import { createAdminClient } from "@/lib/supabase/admin";

export async function cancelBookingAction(token: string): Promise<CancelResult> {
  try {
    let emailData: BookingEmailData | null = null;
    const result = await cancelByToken(createAdminClient(), String(token), (data) => {
      emailData = data;
    });

    if (result.status === "cancelled" && emailData) {
      const data: BookingEmailData = emailData;
      after(async () => {
        try {
          await sendCancellationEmail(data, { transport: getEmailTransport() });
        } catch (error) {
          console.error(`[email] cancellation for booking ${data.bookingId} crashed:`, (error as Error).message);
        }
      });
    }
    return result;
  } catch (error) {
    console.error("[cancel] unexpected error:", (error as Error).message);
    return { status: "error" };
  }
}
