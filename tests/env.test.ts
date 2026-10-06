import { describe, expect, it } from "vitest";

import { parseEnv, publicSupabaseEnvSchema } from "@/lib/env";

describe("parseEnv", () => {
  it("returns parsed values when the environment is valid", () => {
    const env = parseEnv(publicSupabaseEnvSchema, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("lists missing and invalid variable names", () => {
    expect(() =>
      parseEnv(publicSupabaseEnvSchema, {
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      }),
    ).toThrow(
      "Invalid or missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("never includes values in the error message", () => {
    const secret = "super-secret-value-that-is-not-a-url";

    let message = "";
    try {
      parseEnv(publicSupabaseEnvSchema, {
        NEXT_PUBLIC_SUPABASE_URL: secret,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).not.toContain(secret);
  });
});
