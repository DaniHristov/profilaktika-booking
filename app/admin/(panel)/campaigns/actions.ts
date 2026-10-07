"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { campaignSchema } from "@/lib/admin/campaign-schema";
import { MAX_GENERATOR_DAYS } from "@/lib/admin/dates";
import { adminErrorMessage, type AdminActionResult } from "@/lib/admin/errors";
import { NotAdminError, requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();

async function guard<T>(run: () => Promise<AdminActionResult<T>>): Promise<AdminActionResult<T>> {
  try {
    await requireAdmin();
    return await run();
  } catch (error) {
    if (error instanceof NotAdminError) return { ok: false, message: adminErrorMessage("PB100") };
    console.error("[admin] action failed:", (error as Error).message);
    return { ok: false, message: adminErrorMessage(undefined) };
  }
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    result[key] ??= issue.message;
  }
  return result;
}

export async function saveCampaignAction(
  id: string | null,
  input: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  return guard(async () => {
    if (id !== null && !uuid.safeParse(id).success) {
      return { ok: false, message: adminErrorMessage("PB105") };
    }
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: fieldErrorsOf(parsed.error) };
    }
    const c = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_save_campaign", {
      p_id: id as string,
      p_slug: c.slug,
      p_title: c.title,
      p_location_address: c.locationAddress,
      p_location_note: c.locationNote,
      p_is_active: c.isActive,
      p_booking_closes_hours_before: c.bookingClosesHoursBefore,
      p_allow_public_cancel: c.allowPublicCancel,
      p_cancel_closes_hours_before: c.cancelClosesHoursBefore,
    });
    if (error) {
      return {
        ok: false,
        message: adminErrorMessage(error.code),
        fieldErrors: error.code === "PB104" ? { slug: adminErrorMessage("PB104") } : undefined,
      };
    }
    refresh();
    return { ok: true, data: { id: data } };
  });
}

const generatorSchema = z.object({
  campaignId: z.uuid(),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1, "Изберете поне една дата.")
    .max(MAX_GENERATOR_DAYS),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Въведете начален час."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Въведете краен час."),
  durationMin: z.coerce.number().int().min(5, "Поне 5 минути.").max(480, "Най-много 480 минути."),
  capacity: z.coerce.number().int().min(1, "Поне 1 място.").max(100, "Най-много 100 места."),
});

export type GeneratedSlot = { startsAt: string; status: "new" | "exists" | "past" };

export async function generateSlotsAction(
  input: unknown,
  dryRun: boolean,
): Promise<AdminActionResult<GeneratedSlot[]>> {
  return guard(async () => {
    const parsed = generatorSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: fieldErrorsOf(parsed.error) };
    }
    const g = parsed.data;
    if (g.end <= g.start) {
      return { ok: false, message: adminErrorMessage("PB103"), fieldErrors: { end: "Крайният час трябва да е след началния." } };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_generate_slots", {
      p_campaign_id: g.campaignId,
      p_dates: g.dates,
      p_start: g.start,
      p_end: g.end,
      p_duration_min: g.durationMin,
      p_capacity: g.capacity,
      p_dry_run: dryRun,
    });
    if (error) return { ok: false, message: adminErrorMessage(error.code) };
    if (!dryRun) refresh();
    return {
      ok: true,
      data: data.map((row) => ({
        startsAt: new Date(row.starts_at).toISOString(),
        status: row.status as GeneratedSlot["status"],
      })),
    };
  });
}

export async function updateSlotAction(
  slotId: string,
  isBlocked: boolean,
  capacity: number,
): Promise<AdminActionResult> {
  return guard(async () => {
    if (!uuid.safeParse(slotId).success || !Number.isInteger(capacity)) {
      return { ok: false, message: adminErrorMessage("PB103") };
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_slot", {
      p_slot_id: slotId,
      p_is_blocked: Boolean(isBlocked),
      p_capacity: capacity,
    });
    if (error) return { ok: false, message: adminErrorMessage(error.code) };
    refresh();
    return { ok: true, data: null };
  });
}

export async function deleteSlotAction(slotId: string): Promise<AdminActionResult> {
  return guard(async () => {
    if (!uuid.safeParse(slotId).success) return { ok: false, message: adminErrorMessage("PB105") };
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_delete_slot", { p_slot_id: slotId });
    if (error) return { ok: false, message: adminErrorMessage(error.code) };
    refresh();
    return { ok: true, data: null };
  });
}
