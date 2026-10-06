import { describe, expect, it } from "vitest";

import { groupSlotsByDay } from "@/lib/booking/group";
import type { PublicSlot } from "@/lib/booking/types";

function slot(id: string, startsAt: string, available = true): PublicSlot {
  return { id, startsAt, durationMin: 30, available };
}

describe("groupSlotsByDay", () => {
  it("groups by Sofia day in time order", () => {
    const days = groupSlotsByDay([
      slot("b", "2026-10-15T06:30:00.000Z"),
      slot("c", "2026-10-16T06:00:00.000Z"),
      slot("a", "2026-10-15T06:00:00.000Z"),
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-10-15", "2026-10-16"]);
    expect(days[0].slots.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("drops days without any free slot but keeps full slots on other days", () => {
    const days = groupSlotsByDay([
      slot("a", "2026-10-15T06:00:00.000Z", false),
      slot("b", "2026-10-15T06:30:00.000Z", false),
      slot("c", "2026-10-16T06:00:00.000Z", false),
      slot("d", "2026-10-16T06:30:00.000Z", true),
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-10-16"]);
    expect(days[0].slots.map((s) => [s.id, s.available])).toEqual([
      ["c", false],
      ["d", true],
    ]);
  });

  it("uses the Sofia date near midnight UTC", () => {
    const days = groupSlotsByDay([slot("a", "2026-10-14T22:30:00.000Z")]);
    expect(days[0].key).toBe("2026-10-15");
  });
});
