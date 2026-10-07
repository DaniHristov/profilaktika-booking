import "server-only";

import type { z } from "zod";

import { adminErrorMessage, type AdminActionResult } from "@/lib/admin/errors";
import { NotAdminError, requireAdmin, type AdminUser } from "@/lib/auth/admin";

/**
 * Wraps every admin server action: re-checks the admin session on the server
 * and turns unexpected errors into a generic message (logged without data).
 */
export async function runAdminAction<T>(
  run: (admin: AdminUser) => Promise<AdminActionResult<T>>,
): Promise<AdminActionResult<T>> {
  try {
    const admin = await requireAdmin();
    return await run(admin);
  } catch (error) {
    if (error instanceof NotAdminError) return { ok: false, message: adminErrorMessage("PB100") };
    console.error("[admin] action failed:", (error as Error).message);
    return { ok: false, message: adminErrorMessage(undefined) };
  }
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    result[key] ??= issue.message;
  }
  return result;
}
