"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteSlotAction, updateSlotAction } from "../actions";

type Props = {
  slotId: string;
  label: string;
  isBlocked: boolean;
  capacity: number;
  confirmedCount: number;
  totalBookings: number;
};

export function SlotRowActions({ slotId, label, isBlocked, capacity, confirmedCount, totalBookings }: Props) {
  const [cap, setCap] = useState(String(capacity));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? null);
    });
  }

  const capValue = Number(cap);
  const capChanged = cap !== String(capacity);
  const canDelete = totalBookings === 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateSlotAction(slotId, isBlocked, capValue));
          }}
        >
          <label htmlFor={`cap-${slotId}`} className="sr-only">
            Места за {label}
          </label>
          <Input
            id={`cap-${slotId}`}
            type="number"
            min={Math.max(1, confirmedCount)}
            max={100}
            inputMode="numeric"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="h-8 w-16"
            disabled={isPending}
          />
          {capChanged ? (
            <Button type="submit" size="sm" variant="secondary" disabled={isPending || !Number.isInteger(capValue)}>
              Запази
            </Button>
          ) : null}
        </form>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => updateSlotAction(slotId, !isBlocked, capacity))}
          aria-label={`${isBlocked ? "Отблокирай" : "Блокирай"} ${label}`}
        >
          {isBlocked ? "Отблокирай" : "Блокирай"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending || !canDelete}
          title={canDelete ? undefined : "Часът има записвания и не може да бъде изтрит."}
          aria-label={`Изтрий ${label}`}
          onClick={() => {
            if (window.confirm(`Да изтрия ли часа ${label}?`)) run(() => deleteSlotAction(slotId));
          }}
        >
          Изтрий
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
