import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { describe, expect, it } from "vitest";

import {
  bookingFormSchema,
  createAdminBookingSchema,
  createBookingEditSchema,
  createBookingSchema,
} from "@/lib/validation/booking";

// Same schema the server uses (server-only module can't be imported here).
const serverSchema = createBookingSchema(parsePhoneNumberFromString);

const valid = {
  slotId: "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a",
  fullName: "Иван Иванов",
  phone: "0888 123 456",
  email: "ivan@example.com",
  workplace: "",
  notes: "",
  consent: true as const,
};

function errorsOf(input: Record<string, unknown>) {
  const result = serverSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("booking schema: phone", () => {
  it.each([
    ["0888123456", "+359888123456"],
    ["088 812 3456", "+359888123456"],
    ["+359 888 123 456", "+359888123456"],
    ["00359888123456", "+359888123456"],
    ["02 987 6543", "+35929876543"],
    ["+359 2 987 6543", "+35929876543"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+49 30 901820", "+4930901820"],
  ])("accepts %s as %s", (input, e164) => {
    const result = serverSchema.parse({ ...valid, phone: input });
    expect(result.phone).toBe(e164);
  });

  it.each(["0888", "12345", "abc", "+359", "0888 123 456 789 000"])("rejects %s", (input) => {
    expect(errorsOf({ ...valid, phone: input }).phone).toMatch(/Невалиден телефонен номер/);
  });

  it("requires a phone", () => {
    expect(errorsOf({ ...valid, phone: "  " }).phone).toBe("Моля, въведете телефон.");
  });

  it("browser schema accepts the same common numbers", () => {
    expect(bookingFormSchema.parse({ ...valid, phone: "0888123456" }).phone).toBe("+359888123456");
    expect(bookingFormSchema.parse({ ...valid, phone: "02 987 6543" }).phone).toBe("+35929876543");
  });
});

describe("booking schema: normalization", () => {
  it("trims and collapses whitespace in the name", () => {
    expect(serverSchema.parse({ ...valid, fullName: "  Мария   Петрова  " }).fullName).toBe(
      "Мария Петрова",
    );
  });

  it("trims and lowercases the email", () => {
    expect(serverSchema.parse({ ...valid, email: "  Ivan@Example.COM " }).email).toBe(
      "ivan@example.com",
    );
  });

  it("turns empty optional fields into null and trims the rest", () => {
    const result = serverSchema.parse({ ...valid, workplace: "   ", notes: "  Бележка " });
    expect(result.workplace).toBeNull();
    expect(result.notes).toBe("Бележка");
  });
});

describe("booking schema: validation", () => {
  it("requires name, valid email, consent and a slot", () => {
    const errors = errorsOf({
      ...valid,
      slotId: "not-a-uuid",
      fullName: "   ",
      email: "not-an-email",
      consent: false,
    });
    expect(errors.slotId).toBe("Моля, изберете час.");
    expect(errors.fullName).toBe("Моля, въведете име и фамилия.");
    expect(errors.email).toBe("Невалиден имейл адрес.");
    expect(errors.consent).toBe("Необходимо е съгласие за обработка на личните данни.");
  });

  it("enforces length limits", () => {
    const errors = errorsOf({
      ...valid,
      fullName: "а".repeat(101),
      workplace: "б".repeat(151),
      notes: "в".repeat(1001),
      email: `${"a".repeat(250)}@example.com`,
    });
    expect(errors.fullName).toMatch(/до 100 знака/);
    expect(errors.workplace).toMatch(/до 150 знака/);
    expect(errors.notes).toMatch(/до 1000 знака/);
    expect(errors.email).toBe("Имейлът е твърде дълъг.");
  });

  it("accepts limits exactly", () => {
    expect(
      serverSchema.safeParse({
        ...valid,
        fullName: "а".repeat(100),
        workplace: "б".repeat(150),
        notes: "в".repeat(1000),
      }).success,
    ).toBe(true);
  });
});

describe("admin booking and edit schemas", () => {
  const adminSchema = createAdminBookingSchema(parsePhoneNumberFromString);
  const editSchema = createBookingEditSchema(parsePhoneNumberFromString);
  const admin = {
    slotId: valid.slotId,
    fullName: "Обадил Се",
    phone: "0899 555 444",
    email: "",
    workplace: "",
    notes: "",
    oralConsent: true as const,
  };

  it("allows an empty email (null) and requires oral consent", () => {
    expect(adminSchema.parse(admin).email).toBeNull();
    const result = adminSchema.safeParse({ ...admin, oralConsent: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Потвърдете, че служителят е дал устно съгласие.");
  });

  it("still validates a given email and normalizes it", () => {
    expect(adminSchema.parse({ ...admin, email: " A@Example.com " }).email).toBe("a@example.com");
    expect(adminSchema.safeParse({ ...admin, email: "not-an-email" }).success).toBe(false);
  });

  it("edit schema accepts an empty email; the database decides if it is allowed", () => {
    const { slotId: _slot, oralConsent: _consent, ...contact } = admin;
    expect(editSchema.parse(contact).email).toBeNull();
    expect(editSchema.parse({ ...contact, email: "x@example.com" }).email).toBe("x@example.com");
  });
});
