import { parsePhoneNumberFromString as parsePhoneMin } from "libphonenumber-js/min";
import type { PhoneNumber } from "libphonenumber-js";
import { z } from "zod";

type ParsePhone = (text: string, defaultCountry: "BG") => PhoneNumber | undefined;

export const BOOKING_LIMITS = {
  fullName: 100,
  phone: 20,
  email: 254,
  workplace: 150,
  notes: 1000,
} as const;

function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === "" ? null : value));
}

function contactFields(parsePhone: ParsePhone) {
  return {
    fullName: z
      .string()
      .trim()
      .overwrite((value) => value.replace(/\s+/g, " "))
      .min(1, "Моля, въведете име и фамилия.")
      .max(BOOKING_LIMITS.fullName, `Името може да е до ${BOOKING_LIMITS.fullName} знака.`),
    phone: z
      .string()
      .trim()
      .min(1, "Моля, въведете телефон.")
      .max(30, "Невалиден телефонен номер.")
      .transform((value, ctx) => {
        const phone = parsePhone(value, "BG");
        if (!phone || !phone.isValid()) {
          ctx.addIssue({
            code: "custom",
            message: "Невалиден телефонен номер. Пример: 0888 123 456 или +359 888 123 456.",
          });
          return z.NEVER;
        }
        // E.164, e.g. +359888123456
        return phone.number;
      }),
    workplace: optionalText(
      BOOKING_LIMITS.workplace,
      `Работното място може да е до ${BOOKING_LIMITS.workplace} знака.`,
    ),
    notes: optionalText(
      BOOKING_LIMITS.notes,
      `Полето „Допълнително“ може да е до ${BOOKING_LIMITS.notes} знака.`,
    ),
  };
}

const requiredEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Моля, въведете имейл.")
  .max(BOOKING_LIMITS.email, "Имейлът е твърде дълъг.")
  .pipe(z.email("Невалиден имейл адрес."));

/** Optional email (admin bookings): empty becomes null. */
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(BOOKING_LIMITS.email, "Имейлът е твърде дълъг.")
  .refine((value) => value === "" || z.email().safeParse(value).success, "Невалиден имейл адрес.")
  .transform((value) => (value === "" ? null : value));

/**
 * Builds the public booking form schema. The phone parser is injected so the
 * server can use libphonenumber's full metadata (exact validation) while the
 * browser uses the smaller default metadata for instant feedback.
 */
export function createBookingSchema(parsePhone: ParsePhone) {
  return z.object({
    slotId: z.uuid("Моля, изберете час."),
    ...contactFields(parsePhone),
    email: requiredEmail,
    consent: z.literal(true, "Необходимо е съгласие за обработка на личните данни."),
  });
}

/** Manual booking by an admin: email optional, oral consent confirmed. */
export function createAdminBookingSchema(parsePhone: ParsePhone) {
  return z.object({
    slotId: z.uuid("Моля, изберете час."),
    ...contactFields(parsePhone),
    email: optionalEmail,
    oralConsent: z.literal(true, "Потвърдете, че служителят е дал устно съгласие."),
  });
}

/**
 * Admin edit of contact data. The email may be emptied here; the database
 * still requires it for bookings made on the public page.
 */
export function createBookingEditSchema(parsePhone: ParsePhone) {
  return z.object({ ...contactFields(parsePhone), email: optionalEmail });
}

/** Schema for the browser (smaller phone metadata). */
export const bookingFormSchema = createBookingSchema(parsePhoneMin);

export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormData = z.output<typeof bookingFormSchema>;
export type BookingField = keyof BookingFormInput;
