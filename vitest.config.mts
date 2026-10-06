import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { defineConfig } from "vitest/config";

function localEnv(): Record<string, string> {
  if (!existsSync(".env.local")) return {};
  return parseEnv(readFileSync(".env.local", "utf8")) as Record<string, string>;
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Lets unit tests import server modules; the real guard applies in Next.js builds.
      "server-only": resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        // Runs against the local Supabase stack (`npm run db:start`).
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          env: localEnv(),
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
