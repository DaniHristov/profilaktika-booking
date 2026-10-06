import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only the admin panel uses Supabase Auth sessions. Public booking pages do
// not touch auth cookies.
export const config = {
  matcher: ["/admin/:path*"],
};
