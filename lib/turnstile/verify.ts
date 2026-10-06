const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's published test secrets (always pass / always fail / token
// already spent). Allowed for local development only.
const TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export type TurnstileOptions = {
  secret: string;
  remoteIp?: string;
  isProduction?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Verifies a Turnstile token on the server. Fails closed: any network error,
 * timeout or unexpected response counts as a failed check.
 */
export async function verifyTurnstileToken(
  token: string,
  {
    secret,
    remoteIp,
    isProduction = process.env.VERCEL_ENV === "production",
    fetchImpl = fetch,
    timeoutMs = 5_000,
  }: TurnstileOptions,
): Promise<boolean> {
  if (isProduction && TEST_SECRETS.has(secret)) {
    console.error("[turnstile] test secret key used in production; refusing");
    return false;
  }
  if (!token || token.length > 2048) {
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error(`[turnstile] siteverify HTTP ${response.status}`);
      return false;
    }
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch (error) {
    console.error("[turnstile] siteverify request failed:", (error as Error).name);
    return false;
  }
}
