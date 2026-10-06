import type { PublicSlot } from "@/lib/booking/types";
import { dateKey } from "@/lib/datetime";

export type SlotDay = {
  /** "2026-10-15" (Europe/Sofia) */
  key: string;
  /** First slot's start, for formatting the day label. */
  date: Date;
  slots: PublicSlot[];
};

/**
 * Groups slots by Sofia calendar day, keeping only days that still have at
 * least one free slot. Full slots stay in their day so they can be shown as
 * taken.
 */
export function groupSlotsByDay(slots: PublicSlot[]): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const start = new Date(slot.startsAt);
    const key = dateKey(start);
    const day = days.get(key) ?? { key, date: start, slots: [] };
    day.slots.push(slot);
    days.set(key, day);
  }
  return [...days.values()].filter((day) => day.slots.some((s) => s.available));
}
