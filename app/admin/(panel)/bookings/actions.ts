"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { runAdminAction, zodFieldErrors } from "@/lib/admin/action";
import { adminErrorMessage, type AdminActionResult } from "@/lib/admin/errors";
import { sendCancellationEmail, sendMovedEmail } from "@/lib/booking/notifications";
import { cancelUrlFor, type BookingEmailData } from "@/lib/email/booking-emails";
import { getEmailTransport } from "@/lib/email/transport";
import { getAppUrl } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { bookingServerSchema } from "@/lib/validation/booking.server";

const uuid = z.uuid();

const editSchema = bookingServerSchema.pick({
  fullName: true,
  phone: true,
  email: true,
  workplace: true,
  notes: true,
});

export async function updateBookingAction(bookingId: string, input: unknown): Promise<AdminActionResult> {
  return runAdminAction(async () => {
    if (!uuid.safeParse(bookingId).success) return { ok: false, message: adminErrorMessage("PB105") };
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: zodFieldErrors(parsed.error) };
    }
    const b = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_booking", {
      p_booking_id: bookingId,
      p_full_name: b.fullName,
      p_phone: b.phone,
      p_email: b.email,
      p_workplace: b.workplace ?? "",
      p_notes: b.notes ?? "",
    });
    if (error) {
      return {
        ok: false,
        message: adminErrorMessage(error.code),
        fieldErrors: error.code === "PB002" ? { email: adminErrorMessage("PB002") } : undefined,
      };
    }
    refresh();
    return { ok: true, data: null };
  });
}

/** Emails run after the response; a failing provider never undoes the change. */
function afterEmail(label: string, send: () => Promise<unknown>) {
  after(async () => {
    try {
      await send();
    } catch (error) {
      console.error(`[email] ${label} crashed:`, (error as Error).message);
    }
  });
}

export async function moveBookingAction(bookingId: string, newSlotId: string): Promise<AdminActionResult> {
  return runAdminAction(async () => {
    if (!uuid.safeParse(bookingId).success || !uuid.safeParse(newSlotId).success) {
      return { ok: false, message: adminErrorMessage("PB103") };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_move_booking", {
      p_booking_id: bookingId,
      p_new_slot_id: newSlotId,
    });
    if (error) return { ok: false, message: adminErrorMessage(error.code) };

    const row = data[0];
    const email: BookingEmailData = {
      bookingId: row.booking_id,
      fullName: row.full_name,
      email: row.email,
      startsAt: new Date(row.starts_at),
      durationMin: row.duration_min,
      campaignTitle: row.campaign_title,
      locationAddress: row.location_address,
      locationNote: row.location_note,
    };
    const cancelUrl = row.allow_public_cancel ? cancelUrlFor(getAppUrl(), row.cancel_token) : null;
    afterEmail(`move notice for booking ${row.booking_id}`, () =>
      sendMovedEmail(email, cancelUrl, { transport: getEmailTransport() }),
    );
    refresh();
    return { ok: true, data: null };
  });
}

export async function cancelBookingAction(bookingId: string): Promise<AdminActionResult> {
  return runAdminAction(async () => {
    if (!uuid.safeParse(bookingId).success) return { ok: false, message: adminErrorMessage("PB105") };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_cancel_booking", { p_booking_id: bookingId });
    if (error) {
      return {
        ok: false,
        message: error.code === "PB005" ? "Записването вече е отменено." : adminErrorMessage(error.code),
      };
    }
    const row = data[0];
    const email: BookingEmailData = {
      bookingId: row.booking_id,
      fullName: row.full_name,
      email: row.email,
      startsAt: new Date(row.starts_at),
      durationMin: row.duration_min,
      campaignTitle: row.campaign_title,
      locationAddress: row.location_address,
      locationNote: row.location_note,
    };
    afterEmail(`cancellation for booking ${row.booking_id}`, () =>
      sendCancellationEmail(email, { transport: getEmailTransport() }),
    );
    refresh();
    return { ok: true, data: null };
  });
}
