import "server-only";

import { z } from "zod";

import { parseEnv } from "@/lib/env";

export const serviceRoleEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getServiceRoleEnv() {
  return parseEnv(serviceRoleEnvSchema, {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
