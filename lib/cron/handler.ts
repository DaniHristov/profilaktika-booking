import "server-only";

import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";

/**
 * Wraps a cron job: refuses requests without the CRON_SECRET bearer token,
 * returns the job's counts as JSON and logs failures without details.
 */
export function cronHandler(name: string, job: () => Promise<Record<string, unknown>>) {
  return async function GET(request: Request) {
    if (!isAuthorizedCronRequest(request.headers)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      const result = await job();
      console.info(`[cron] ${name}: ${JSON.stringify(result)}`);
      return NextResponse.json({ job: name, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error(`[cron] ${name} failed:`, (error as Error).message);
      return NextResponse.json({ job: name, error: "failed" }, { status: 500 });
    }
  };
}

/** DATA_RETENTION_MONTHS, default 12, 1-120. */
export function retentionMonths(value = process.env.DATA_RETENTION_MONTHS): number {
  const months = Number(value ?? 12);
  return Number.isInteger(months) && months >= 1 && months <= 120 ? months : 12;
}
