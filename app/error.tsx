"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Възникна грешка
      </h1>
      <p className="text-muted-foreground">
        Моля, опитайте отново след малко.
        {error.digest ? ` Код на грешката: ${error.digest}` : null}
      </p>
      <div>
        <Button onClick={() => retry()}>Опитай отново</Button>
      </div>
    </main>
  );
}
