import { describe, expect, it } from "vitest";

import { formatPhone } from "@/lib/format/phone";

describe("formatPhone", () => {
  it.each([
    ["+359888123456", "0888 123 456"],
    ["+359987654321", "0987 654 321"],
    ["+35929876543", "02 987 6543"],
    ["+35932123456", "032 123 456"],
    ["+442079460958", "+44 20 7946 0958"],
    ["+4930901820", "+49 30 901820"],
  ])("%s -> %s", (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });

  it("keeps unparseable values and handles empty ones", () => {
    expect(formatPhone("not-a-phone")).toBe("not-a-phone");
    expect(formatPhone(null)).toBe("");
  });
});
