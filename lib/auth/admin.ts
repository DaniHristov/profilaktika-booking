import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type AdminUser = { userId: string; email: string };

export type AdminSession =
  | { status: "anonymous" }
  | { status: "forbidden"; email: string }
  | { status: "admin"; admin: AdminUser };

/**
 * The authoritative admin check: a valid Supabase session AND a row in
 * public.admins (checked in the database on every request, so removing an
 * admin takes effect immediately). Cached per request.
 */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { status: "anonymous" };

  const email = typeof claims.email === "string" ? claims.email : "";
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    throw new Error(`is_admin failed: ${adminError.code}`);
  }
  if (isAdmin !== true) return { status: "forbidden", email };
  return { status: "admin", admin: { userId: claims.sub, email } };
});

/** For pages: redirects to the login page when not signed in. */
export async function requireAdminPage(): Promise<AdminSession & { status: "admin" | "forbidden" }> {
  const session = await getAdminSession();
  if (session.status === "anonymous") redirect("/admin/login");
  return session;
}

export class NotAdminError extends Error {
  constructor() {
    super("NOT_ADMIN");
  }
}

/** For server actions and route handlers: throws unless the caller is an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await getAdminSession();
  if (session.status !== "admin") throw new NotAdminError();
  return session.admin;
}
