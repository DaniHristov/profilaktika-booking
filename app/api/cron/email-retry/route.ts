import { cronHandler } from "@/lib/cron/handler";
import { retryConfirmations } from "@/lib/cron/jobs";
import { getEmailTransport } from "@/lib/email/transport";
import { getAppUrl } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Daily on Hobby (hourly on Pro: change only the schedule in vercel.json).
export const GET = cronHandler("email-retry", () =>
  retryConfirmations({ db: createAdminClient(), transport: getEmailTransport(), appUrl: getAppUrl() }),
);
