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

/**
 * Builds the booking form schema. The phone parser is injected so the server
 * can use libphonenumber's full metadata (exact validation) while the browser
 * uses the smaller default metadata for instant feedback.
 */
export function createBookingSchema(parsePhone: ParsePhone) {
  return z.object({
    slotId: z.uuid("Моля, изберете час."),
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
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Моля, въведете имейл.")
      .max(BOOKING_LIMITS.email, "Имейлът е твърде дълъг.")
      .pipe(z.email("Невалиден имейл адрес.")),
    workplace: optionalText(
      BOOKING_LIMITS.workplace,
      `Работното място може да е до ${BOOKING_LIMITS.workplace} знака.`,
    ),
    notes: optionalText(
      BOOKING_LIMITS.notes,
      `Полето „Допълнително“ може да е до ${BOOKING_LIMITS.notes} знака.`,
    ),
    consent: z.literal(true, "Необходимо е съгласие за обработка на личните данни."),
  });
}

/** Schema for the browser (smaller phone metadata). */
export const bookingFormSchema = createBookingSchema(parsePhoneMin);

export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormData = z.output<typeof bookingFormSchema>;
export type BookingField = keyof BookingFormInput;
