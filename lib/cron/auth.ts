import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Anything else is
 * refused, including when CRON_SECRET is not configured.
 */
export function isAuthorizedCronRequest(headers: Headers, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16) return false;
  const header = headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
