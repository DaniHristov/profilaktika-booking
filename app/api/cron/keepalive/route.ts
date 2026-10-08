import { cronHandler } from "@/lib/cron/handler";
import { keepAlive } from "@/lib/cron/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily: keeps the free Supabase project from being paused.
export const GET = cronHandler("keepalive", () => keepAlive(createAdminClient()));
