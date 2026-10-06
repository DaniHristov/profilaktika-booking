import { describe, expect, it } from "vitest";

import { buildIcs } from "@/lib/calendar/ics";

const event = {
  uid: "b1c2d3e4@profilaktika",
  start: new Date("2026-10-15T06:00:00Z"),
  durationMin: 30,
  summary: "Профилактичен преглед – Медицински център",
  location: "гр. София, ул. Примерна 1; Етаж 2, кабинет 5",
};

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-07T10:00:00Z"));

  it("produces a single VEVENT in UTC with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261015T060000Z\r\n");
    expect(ics).toContain("DTEND:20261015T063000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261007T100000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes commas and semicolons", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("LOCATION:гр. София\\, ул. Примерна 1\\; Етаж 2\\, кабинет 5");
  });

  it("folds lines to at most 75 octets without splitting characters", () => {
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${event.summary}`);
  });

  it("omits empty optional fields", () => {
    const minimal = buildIcs({ ...event, location: null });
    expect(minimal).not.toContain("LOCATION:");
    expect(minimal).not.toContain("DESCRIPTION:");
  });
});
