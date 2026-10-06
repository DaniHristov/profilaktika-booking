import "server-only";

import { parsePhoneNumberFromString } from "libphonenumber-js/max";

import { createBookingSchema } from "@/lib/validation/booking";

/** Authoritative server-side schema (full phone metadata). */
export const bookingServerSchema = createBookingSchema(parsePhoneNumberFromString);
