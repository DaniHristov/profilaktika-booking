"use client";

import { CheckCircle2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CANCEL_MESSAGES } from "@/lib/booking/cancel-messages";
import type { CancelResult, CancelState } from "@/lib/booking/cancel";
import { useHydrated } from "@/lib/use-hydrated";

import { cancelBookingAction } from "../actions";

const STATE_MESSAGES: Record<Exclude<CancelState, "allowed">, string> = {
  cancelled: CANCEL_MESSAGES.alreadyCancelled,
  disabled: CANCEL_MESSAGES.disabled,
  closed: CANCEL_MESSAGES.closed,
};

const RESULT_MESSAGES: Record<Exclude<CancelResult["status"], "cancelled">, string> = {
  already_cancelled: CANCEL_MESSAGES.alreadyCancelled,
  disabled: CANCEL_MESSAGES.disabled,
  closed: CANCEL_MESSAGES.closed,
  not_found: CANCEL_MESSAGES.notFound,
  error: CANCEL_MESSAGES.error,
};

export function CancelPanel({ token, state }: { token: string; state: CancelState }) {
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const successRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  if (done) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col gap-2 rounded-xl border border-border p-5 outline-none"
      >
        <p className="flex items-start gap-2 text-lg font-semibold">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-600" />
          {CANCEL_MESSAGES.success}
        </p>
        <p className="text-base">{CANCEL_MESSAGES.successEmail}</p>
        <p className="text-base font-medium">{CANCEL_MESSAGES.deleteFromCalendar}</p>
      </div>
    );
  }

  if (state !== "allowed") {
    return <p className="rounded-xl border border-border p-5 text-base">{STATE_MESSAGES[state]}</p>;
  }

  function cancel() {
    setMessage(null);
    startTransition(async () => {
      const result = await cancelBookingAction(token);
      if (result.status === "cancelled") {
        setDone(true);
        requestAnimationFrame(() => successRef.current?.focus());
        return;
      }
      setMessage(RESULT_MESSAGES[result.status]);
      requestAnimationFrame(() => messageRef.current?.focus());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base">{CANCEL_MESSAGES.intro}</p>
      <p
        ref={messageRef}
        tabIndex={-1}
        role="alert"
        className={
          message
            ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-base text-destructive outline-none"
            : "sr-only"
        }
      >
        {message}
      </p>
      <div>
        <Button
          variant="destructive"
          size="lg"
          className="h-12 w-full px-6 text-base sm:w-auto"
          onClick={cancel}
          disabled={isPending || !hydrated}
        >
          {isPending ? CANCEL_MESSAGES.pending : CANCEL_MESSAGES.button}
        </Button>
      </div>
    </div>
  );
}
