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

export const bookingEnvSchema = z.object({
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // HMAC key for hashing client IPs in the rate limiter.
  IP_HASH_SECRET: z.string().min(32),
});

export function getBookingEnv() {
  return parseEnv(bookingEnvSchema, {
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    IP_HASH_SECRET: process.env.IP_HASH_SECRET,
  });
}
