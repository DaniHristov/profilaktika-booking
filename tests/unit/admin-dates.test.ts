import { describe, expect, it } from "vitest";

import { datesInRange, formatIsoDate, isoWeekdayOf } from "@/lib/admin/dates";
import { campaignSchema } from "@/lib/admin/campaign-schema";

describe("datesInRange", () => {
  it("keeps only the selected weekdays (Mon-Fri)", () => {
    // 2026-10-12 is a Monday.
    expect(datesInRange("2026-10-12", "2026-10-18", [1, 2, 3, 4, 5])).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });

  it("works across the DST change and month ends", () => {
    expect(datesInRange("2026-10-24", "2026-11-02", [1])).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("includes a single day", () => {
    expect(datesInRange("2026-10-15", "2026-10-15", [4])).toEqual(["2026-10-15"]);
  });

  it("rejects invalid input and too long ranges", () => {
    expect(datesInRange("2026-10-20", "2026-10-10", [1])).toBeNull();
    expect(datesInRange("2026-02-30", "2026-03-02", [1])).toBeNull();
    expect(datesInRange("15.10.2026", "2026-10-20", [1])).toBeNull();
    expect(datesInRange("2026-01-01", "2027-01-02", [1])).toBeNull();
  });

  it("formats and identifies weekdays", () => {
    expect(formatIsoDate("2026-10-15")).toBe("15.10.2026");
    expect(isoWeekdayOf("2026-10-18")).toBe(7);
  });
});

describe("campaignSchema", () => {
  const valid = {
    slug: " Firma-2026 ",
    title: "Прегледи",
    locationAddress: "Адрес",
    locationNote: "",
    isActive: true,
    bookingClosesHoursBefore: "2",
    allowPublicCancel: true,
    cancelClosesHoursBefore: "0",
  };

  it("normalizes slug and coerces numbers", () => {
    const data = campaignSchema.parse(valid);
    expect(data.slug).toBe("firma-2026");
    expect(data.bookingClosesHoursBefore).toBe(2);
  });

  it("rejects bad slugs and hours", () => {
    expect(campaignSchema.safeParse({ ...valid, slug: "firma 2026" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...valid, slug: "-firma" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...valid, slug: "фирма" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...valid, bookingClosesHoursBefore: "-1" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...valid, cancelClosesHoursBefore: "1.5" }).success).toBe(false);
  });
});
