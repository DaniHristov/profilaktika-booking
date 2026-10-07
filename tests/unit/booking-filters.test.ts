import { describe, expect, it } from "vitest";

import { bookingFiltersToQuery, parseBookingFilters } from "@/lib/admin/booking-filters";

describe("parseBookingFilters", () => {
  it("defaults to confirmed bookings, page 1", () => {
    expect(parseBookingFilters({})).toEqual({
      campaignId: null,
      date: null,
      time: null,
      status: "confirmed",
      q: null,
      page: 1,
    });
  });

  it("reads valid values", () => {
    expect(
      parseBookingFilters({
        campaign: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a",
        date: "2026-10-15",
        time: "09:30",
        status: "all",
        q: "  Иван ",
        page: "3",
      }),
    ).toEqual({
      campaignId: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a",
      date: "2026-10-15",
      time: "09:30",
      status: "all",
      q: "Иван",
      page: 3,
    });
  });

  it("ignores invalid values instead of failing", () => {
    expect(
      parseBookingFilters({ campaign: "x", date: "15.10.2026", time: "25:00", status: "deleted", page: "-1", q: "a".repeat(200) }),
    ).toEqual({ campaignId: null, date: null, time: null, status: "confirmed", q: null, page: 1 });
  });

  it("round-trips through the query string without defaults", () => {
    const filters = parseBookingFilters({ date: "2026-10-15", q: "0888 123", status: "cancelled" });
    const query = bookingFiltersToQuery(filters, { page: 2 });
    expect(query).toBe("?date=2026-10-15&status=cancelled&q=0888+123&page=2");
    expect(parseBookingFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual({ ...filters, page: 2 });
    expect(bookingFiltersToQuery(parseBookingFilters({}))).toBe("");
  });
});
