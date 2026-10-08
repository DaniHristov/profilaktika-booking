import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

import { expect } from "@playwright/test";

const env = parseEnv(readFileSync(".env.local", "utf8")) as Record<string, string>;

/** Waits for an email preview (file transport) to `to` whose subject starts with `subjectPrefix`. */
export async function waitForEmail(to: string, subjectPrefix: string): Promise<string> {
  let text = "";
  await expect
    .poll(
      () => {
        if (!existsSync(".emails")) return false;
        for (const file of readdirSync(".emails").filter((f) => f.endsWith(".txt"))) {
          const content = readFileSync(join(".emails", file), "utf8");
          if (content.includes(`To: ${to}`) && content.includes(`Subject: ${subjectPrefix}`)) {
            text = content;
            return true;
          }
        }
        return false;
      },
      { timeout: 20_000, message: `email "${subjectPrefix}" to ${to}` },
    )
    .toBe(true);
  return text;
}

/** One-time sign-in link for a seeded user, via the local Supabase admin API. */
export async function adminSignInUrl(baseUrl: string, email = "admin@example.invalid"): Promise<string> {
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const body = (await response.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const token = body.hashed_token ?? body.properties?.hashed_token;
  if (!token) throw new Error("generate_link returned no token");
  return `${baseUrl}/auth/confirm?token_hash=${token}&type=email`;
}
