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

export const appUrlEnvSchema = z.object({
  // Base URL for links in emails, e.g. https://zapis.example.bg
  NEXT_PUBLIC_APP_URL: z.url(),
});

export function getAppUrl(): string {
  return parseEnv(appUrlEnvSchema, {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }).NEXT_PUBLIC_APP_URL;
}
