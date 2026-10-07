"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

import { confirmSignInAction } from "../../admin/actions";

export function ConfirmButton({ tokenHash }: { tokenHash: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <>
          <p role="alert" className="text-base text-destructive">
            {error}
          </p>
          <Link href="/admin/login" className="underline underline-offset-4">
            Към страницата за вход
          </Link>
        </>
      ) : (
        <Button
          size="lg"
          className="h-11 text-base"
          disabled={!hydrated || isPending}
          onClick={() =>
            startTransition(async () => {
              // On success the action redirects to /admin.
              const result = await confirmSignInAction(tokenHash);
              if (result) setError(result.message);
            })
          }
        >
          {isPending ? "Влизане…" : "Влез"}
        </Button>
      )}
    </div>
  );
}
