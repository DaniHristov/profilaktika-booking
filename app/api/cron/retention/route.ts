import { cronHandler, retentionMonths } from "@/lib/cron/handler";
import { anonymizeOldBookings } from "@/lib/cron/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily, idempotent: anonymizes bookings older than DATA_RETENTION_MONTHS.
export const GET = cronHandler("retention", () =>
  anonymizeOldBookings(createAdminClient(), retentionMonths()),
);
