import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@/lib/env";
import { getServiceRoleEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client: bypasses RLS. Server-only (cron jobs and other trusted
 * server code). Never import this from a Client Component; `server-only`
 * turns that into a build error.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicSupabaseEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServiceRoleEnv();

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
