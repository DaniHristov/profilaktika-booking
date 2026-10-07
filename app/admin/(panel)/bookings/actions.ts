"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { runAdminAction, zodFieldErrors } from "@/lib/admin/action";
import { adminErrorMessage, type AdminActionResult } from "@/lib/admin/errors";
import {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendMovedEmail,
} from "@/lib/booking/notifications";
import { cancelUrlFor, type BookingEmailData } from "@/lib/email/booking-emails";
import { getEmailTransport } from "@/lib/email/transport";
import { getAppUrl } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  adminBookingServerSchema,
  bookingEditServerSchema,
} from "@/lib/validation/booking.server";

const uuid = z.uuid();

export async function updateBookingAction(bookingId: string, input: unknown): Promise<AdminActionResult> {
  return runAdminAction(async () => {
    if (!uuid.safeParse(bookingId).success) return { ok: false, message: adminErrorMessage("PB105") };
    const parsed = bookingEditServerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: zodFieldErrors(parsed.error) };
    }
    const b = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_booking", {
      p_booking_id: bookingId,
      p_full_name: b.fullName,
      p_phone: b.phone,
      p_email: b.email ?? "",
      p_workplace: b.workplace ?? "",
      p_notes: b.notes ?? "",
    });
    if (error) {
      return {
        ok: false,
        message: adminErrorMessage(error.code),
        fieldErrors:
          error.code === "PB002"
            ? { email: adminErrorMessage("PB002") }
            : error.code === "PB103" && !b.email
              ? { email: "Имейлът е задължителен за записвания от публичната страница." }
              : undefined,
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
    // Admin bookings may have no email.
    if (row.email) afterEmail(`move notice for booking ${row.booking_id}`, () =>
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
    if (row.email) afterEmail(`cancellation for booking ${row.booking_id}`, () =>
      sendCancellationEmail(email, { transport: getEmailTransport() }),
    );
    refresh();
    return { ok: true, data: null };
  });
}

/** Manual booking (e.g. after a phone call). Same locking and capacity rules. */
export async function createAdminBookingAction(input: unknown): Promise<AdminActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = adminBookingServerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: zodFieldErrors(parsed.error) };
    }
    const b = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_book_slot", {
      p_slot_id: b.slotId,
      p_full_name: b.fullName,
      p_phone: b.phone,
      p_email: b.email ?? "",
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
    const bookingId = data[0].booking_id;
    if (b.email) {
      afterEmail(`confirmation for booking ${bookingId}`, () =>
        sendBookingConfirmation(bookingId, {
          db: createAdminClient(),
          transport: getEmailTransport(),
          appUrl: getAppUrl(),
        }),
      );
    }
    refresh();
    return { ok: true, data: { id: bookingId } };
  });
}
