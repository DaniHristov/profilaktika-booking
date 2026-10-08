import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Fresh local database (migrations + seed) and no old email previews.
export default function globalSetup() {
  execSync("npx supabase db reset", { stdio: "inherit" });
  rmSync(".emails", { recursive: true, force: true });
}
