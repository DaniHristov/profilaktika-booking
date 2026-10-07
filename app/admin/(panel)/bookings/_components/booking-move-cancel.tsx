"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MoveTarget } from "@/lib/admin/bookings";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";

import { cancelBookingAction, moveBookingAction } from "../actions";

type Message = { kind: "ok" | "error"; text: string } | null;

function Feedback({ message }: { message: Message }) {
  return (
    <div
      role={message?.kind === "error" ? "alert" : "status"}
      className={
        message
          ? message.kind === "error"
            ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
            : "rounded-lg bg-muted px-3 py-2"
          : "sr-only"
      }
    >
      {message?.text}
    </div>
  );
}

export function BookingMove({ bookingId, targets }: { bookingId: string; targets: MoveTarget[] }) {
  const [slotId, setSlotId] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [isPending, startTransition] = useTransition();

  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">Няма свободни бъдещи часове в тази кампания.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="move-slot">Нов час</Label>
        <select
          id="move-slot"
          value={slotId}
          onChange={(e) => {
            setSlotId(e.target.value);
            setMessage(null);
          }}
          className="h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Изберете час…</option>
          {targets.map((t) => {
            const d = new Date(t.startsAt);
            return (
              <option key={t.id} value={t.id}>
                {formatDate(d)} ({formatWeekday(d)}) {formatTime(d)}
                {t.free > 1 ? ` – ${t.free} свободни места` : ""}
              </option>
            );
          })}
        </select>
      </div>
      <p className="text-sm text-muted-foreground">
        Служителят ще получи имейл с новия час. Може да се премести и след крайния срок за записване.
      </p>
      <Feedback message={message} />
      <div>
        <Button
          type="button"
          disabled={!slotId || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await moveBookingAction(bookingId, slotId);
              if (result.ok) {
                setSlotId("");
                setMessage({ kind: "ok", text: "Записването е преместено. Изпратихме имейл на служителя." });
              } else setMessage({ kind: "error", text: result.message });
            })
          }
        >
          {isPending ? "Преместване…" : "Премести"}
        </Button>
      </div>
    </div>
  );
}

export function BookingCancel({ bookingId, label }: { bookingId: string; label: string }) {
  const [message, setMessage] = useState<Message>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Служителят ще получи имейл за отмяната. Отмененото записване не може да бъде възстановено.
      </p>
      <Feedback message={message} />
      <div>
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm(`Да отменя ли записването на ${label}?`)) return;
            startTransition(async () => {
              const result = await cancelBookingAction(bookingId);
              setMessage(
                result.ok
                  ? { kind: "ok", text: "Записването е отменено. Изпратихме имейл на служителя." }
                  : { kind: "error", text: result.message },
              );
            });
          }}
        >
          {isPending ? "Отменяне…" : "Отмени записването"}
        </Button>
      </div>
    </div>
  );
}
