import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export const RATE_LIMITS = {
  // Every submit, before Turnstile.
  bookingAttempt: { kind: "booking_attempt", limit: 20, window: "10 minutes" },
  // Successful bookings. Generous because employees of one company often
  // share a single public IP.
  bookingSuccess: { kind: "booking_success", limit: 30, window: "1 hour" },
} as const;

type RateLimit = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

const LOCAL_FALLBACK_IP = "127.0.0.1";

/**
 * Client IP for rate limiting. On Vercel only `x-real-ip` is trusted: Vercel
 * sets it, while the first value of `x-forwarded-for` can be spoofed by the
 * client. Locally the header is missing and a fixed fallback is used.
 */
export function getClientIp(headers: Headers): string {
  const ip = headers.get("x-real-ip")?.trim();
  return ip ? ip : LOCAL_FALLBACK_IP;
}

/** HMAC-SHA256 of the IP; raw IPs are never stored. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * Returns true when within the limit. `record` counts this request first.
 * Fails open on database errors so an outage of the limiter does not block
 * bookings (Turnstile still applies); the error is logged.
 */
export async function checkRateLimit(
  db: SupabaseClient<Database>,
  ipHash: string,
  { kind, limit, window }: RateLimit,
  record = true,
): Promise<boolean> {
  const { data, error } = await db.rpc("check_rate_limit", {
    p_ip_hash: ipHash,
    p_kind: kind,
    p_limit: limit,
    p_window: window,
    p_record: record,
  });
  if (error) {
    console.error(`[rate-limit] check failed: ${error.code}`);
    return true;
  }
  return data === true;
}
