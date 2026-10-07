import { NextResponse, type NextRequest } from "next/server";

import { parseBookingFilters } from "@/lib/admin/booking-filters";
import { listBookings } from "@/lib/admin/bookings";
import { NotAdminError, requireAdmin } from "@/lib/auth/admin";
import { dateKey } from "@/lib/datetime";
import { buildExport } from "@/lib/export/build";
import { exportProfiles } from "@/lib/export/profiles";
import { createClient } from "@/lib/supabase/server";

// More rows than any realistic campaign; protects the server from huge files.
const MAX_EXPORT_ROWS = 10_000;

function textResponse(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * GET /admin/bookings/export?profile=standard|joystick&format=xlsx|csv&<filters>
 * Exports exactly what the bookings table shows (all pages). Admin only;
 * every export is recorded in audit_log (without the data).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof NotAdminError) return textResponse(403, "Нямате права за експорт.");
    throw error;
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const profile = exportProfiles[params.profile ?? "standard"];
  if (!profile) return textResponse(400, "Непознат профил за експорт.");
  const format = params.format === "csv" || params.format === "xlsx" ? params.format : profile.format;

  const filters = { ...parseBookingFilters(params), page: 1 };
  const { rows, total } = await listBookings(filters, { limit: MAX_EXPORT_ROWS, offset: 0 });
  if (total > MAX_EXPORT_ROWS) {
    return textResponse(413, `Твърде много записвания (${total}). Стеснете филтрите до ${MAX_EXPORT_ROWS}.`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_log_export", {
    p_profile: profile.id,
    p_format: format,
    p_filters: {
      campaign: filters.campaignId,
      date: filters.date,
      time: filters.time,
      status: filters.status,
      search: filters.q ? true : false,
    },
    p_row_count: rows.length,
  });
  if (error) {
    // No audit entry, no export.
    console.error(`[export] audit failed: ${error.code}`);
    return textResponse(500, "Експортът не беше записан в журнала и е отказан. Опитайте отново.");
  }

  const file = await buildExport(profile, format, rows);
  const stamp = dateKey(new Date()); // Europe/Sofia
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${profile.fileName}-${stamp}.${file.extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
