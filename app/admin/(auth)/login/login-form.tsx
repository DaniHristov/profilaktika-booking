"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestMagicLinkAction } from "../../actions";

const noopSubscribe = () => () => {};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (sent) {
    return (
      <p role="status" className="rounded-lg bg-muted px-4 py-3 text-base">
        Ако имейлът е регистриран като администратор, ще получите линк за вход. Проверете пощата
        си.
      </p>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await requestMagicLinkAction(email);
          if (result.status === "sent") setSent(true);
          else setError(result.message);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email" className="text-base">
          Имейл
        </Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "admin-email-error" : undefined}
          className="h-11 text-base md:text-base"
          disabled={!hydrated || isPending}
        />
        {error ? (
          <p id="admin-email-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="h-11 text-base" disabled={!hydrated || isPending}>
        {isPending ? "Изпращане…" : "Изпрати линк за вход"}
      </Button>
    </form>
  );
}
