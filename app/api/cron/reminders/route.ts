import { cronHandler } from "@/lib/cron/handler";
import { sendReminders } from "@/lib/cron/jobs";
import { getEmailTransport } from "@/lib/email/transport";
import { getAppUrl } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Daily around 15:00 Europe/Sofia: reminders for tomorrow's appointments.
export const GET = cronHandler("reminders", () =>
  sendReminders({ db: createAdminClient(), transport: getEmailTransport(), appUrl: getAppUrl() }),
);
