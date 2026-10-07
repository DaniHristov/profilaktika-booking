import "server-only";

import { parsePhoneNumberFromString } from "libphonenumber-js/max";

import {
  createAdminBookingSchema,
  createBookingEditSchema,
  createBookingSchema,
} from "@/lib/validation/booking";

/** Authoritative server-side schema (full phone metadata). */
export const bookingServerSchema = createBookingSchema(parsePhoneNumberFromString);

export const adminBookingServerSchema = createAdminBookingSchema(parsePhoneNumberFromString);

export const bookingEditServerSchema = createBookingEditSchema(parsePhoneNumberFromString);
