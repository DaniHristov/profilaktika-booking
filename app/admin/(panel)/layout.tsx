import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/admin";

import { signOutAction } from "../actions";
import { AdminNav } from "./admin-nav";

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-base font-semibold">
            Админ панел
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3">
            <Suspense fallback={null}>
              <SignedInAs />
            </Suspense>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Изход
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        <Suspense fallback={<p role="status" className="text-muted-foreground">Зареждане…</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

async function SignedInAs() {
  const session = await requireAdminPage();
  return <span className="hidden text-sm text-muted-foreground sm:inline">{session.status === "admin" ? session.admin.email : session.email}</span>;
}

/**
 * Renders the page only for admins. Data access in every page and action is
 * checked again on the server (requireAdmin) and by RLS.
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  if (session.status === "forbidden") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Нямате достъп</h1>
        <p className="text-base text-muted-foreground">
          Профилът {session.email} не е администратор. Ако смятате, че това е грешка, свържете се с
          отговорника на системата.
        </p>
      </div>
    );
  }
  return children;
}
