"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type MagicLinkResult = { status: "sent" } | { status: "invalid"; message: string };

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/**
 * Sends a sign-in link to existing users only (signups are disabled). Always
 * answers the same way so the form does not reveal who is an admin.
 */
export async function requestMagicLinkAction(email: string): Promise<MagicLinkResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { status: "invalid", message: "Невалиден имейл адрес." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false },
  });
  // Unknown emails are expected (signups are disabled) and are not errors.
  const expected = ["signup_disabled", "otp_disabled", "user_not_found"];
  if (error && !expected.includes(error.code ?? "")) {
    // Rate limits and provider errors; never log the email address.
    console.error(`[auth] signInWithOtp failed: ${error.code ?? error.status}`);
  }
  return { status: "sent" };
}

export type ConfirmResult = { status: "error"; message: string };

/** Exchanges the one-time token from the email for a session. */
export async function confirmSignInAction(tokenHash: string): Promise<ConfirmResult> {
  if (!tokenHash || tokenHash.length > 512) {
    return { status: "error", message: "Линкът за вход е невалиден." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) {
    return {
      status: "error",
      message: "Линкът за вход е невалиден или е изтекъл. Моля, поискайте нов.",
    };
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
