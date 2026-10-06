"use client";

import type { SlotDay } from "@/lib/booking/group";
import { formatDate, formatTime, formatWeekday, formatWeekdayShort } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type Props = {
  days: SlotDay[];
  selectedDayKey: string | null;
  selectedSlotId: string | null;
  onSelectDay: (key: string) => void;
  onSelectSlot: (slotId: string) => void;
  disabled?: boolean;
};

const chip =
  "relative flex cursor-pointer select-none flex-col items-center justify-center rounded-lg border border-input bg-background text-sm transition-colors " +
  // Hover only on selectable, unselected chips so it never overrides the selected/taken look.
  "not-has-[:checked]:not-has-[:disabled]:hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 " +
  "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed has-[:disabled]:bg-muted/60 has-[:disabled]:text-muted-foreground";

export function SlotPicker({
  days,
  selectedDayKey,
  selectedSlotId,
  onSelectDay,
  onSelectSlot,
  disabled,
}: Props) {
  const selectedDay = days.find((d) => d.key === selectedDayKey) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <fieldset disabled={disabled}>
        <legend className="mb-3 text-base font-semibold">1. Изберете дата</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {days.map((day) => (
            <label key={day.key} className={cn(chip, "min-h-14 px-2 py-2")}>
              <input
                type="radio"
                name="day"
                value={day.key}
                checked={day.key === selectedDayKey}
                onChange={() => onSelectDay(day.key)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-xs uppercase opacity-80">
                {formatWeekdayShort(day.date)}
              </span>
              <span aria-hidden="true" className="font-medium tabular-nums">
                {formatDate(day.date).slice(0, 5)}
              </span>
              <span className="sr-only">
                {formatWeekday(day.date)}, {formatDate(day.date)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selectedDay ? (
        <fieldset disabled={disabled}>
          <legend className="mb-3 text-base font-semibold">
            2. Изберете час{" "}
            <span className="font-normal text-muted-foreground">
              ({formatWeekday(selectedDay.date)}, {formatDate(selectedDay.date)})
            </span>
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedDay.slots.map((slot) => {
              const start = new Date(slot.startsAt);
              return (
                <label key={slot.id} className={cn(chip, "min-h-12 px-2 py-1.5")}>
                  <input
                    type="radio"
                    name="slot"
                    value={slot.id}
                    checked={slot.id === selectedSlotId}
                    disabled={!slot.available}
                    onChange={() => onSelectSlot(slot.id)}
                    className="sr-only"
                  />
                  <span className="font-medium tabular-nums">{formatTime(start)}</span>
                  {!slot.available ? (
                    <span className="text-xs">
                      зает<span className="sr-only"> час</span>
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
