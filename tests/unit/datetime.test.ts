import { describe, expect, it } from "vitest";

import { dateKey, formatDate, formatTime, formatWeekday } from "@/lib/datetime";

describe("datetime (Europe/Sofia)", () => {
  it("formats summer time (UTC+3)", () => {
    const date = new Date("2026-10-15T06:00:00Z");
    expect(formatDate(date)).toBe("15.10.2026");
    expect(formatTime(date)).toBe("09:00");
    expect(formatWeekday(date)).toBe("четвъртък");
  });

  it("formats winter time (UTC+2) after the DST change on 25.10.2026", () => {
    const date = new Date("2026-10-26T07:00:00Z");
    expect(formatTime(date)).toBe("09:00");
    expect(formatDate(date)).toBe("26.10.2026");
  });

  it("handles the DST transition night", () => {
    // 03:30 Sofia (UTC+3) is 00:30 UTC; clocks go back at 04:00 local.
    expect(formatTime(new Date("2026-10-25T00:30:00Z"))).toBe("03:30");
    expect(formatTime(new Date("2026-10-25T01:30:00Z"))).toBe("03:30");
  });

  it("groups by the Sofia calendar day, not UTC", () => {
    // 23:30 UTC on 14.10 is 02:30 on 15.10 in Sofia.
    expect(dateKey(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
  });

  it("uses 24-hour time with leading zeros", () => {
    expect(formatTime(new Date("2026-10-15T12:05:00Z"))).toBe("15:05");
    expect(formatTime(new Date("2026-10-14T21:00:00Z"))).toBe("00:00");
  });
});
