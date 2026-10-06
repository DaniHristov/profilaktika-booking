import type { BookingField } from "@/lib/validation/booking";

// Data passed from the server to the public booking page. No personal data.

export type PublicCampaign = {
  title: string;
  locationAddress: string;
  locationNote: string | null;
  isActive: boolean;
};

export type PublicSlot = {
  id: string;
  /** ISO 8601, UTC */
  startsAt: string;
  durationMin: number;
  available: boolean;
};

export type BookingConfirmation = {
  /** Used as the calendar event UID. */
  bookingId: string;
  startsAt: string;
  durationMin: number;
  title: string;
  locationAddress: string;
  locationNote: string | null;
};

export type BookSlotResult =
  | { status: "success"; confirmation: BookingConfirmation }
  | { status: "invalid"; fieldErrors: Partial<Record<BookingField, string>> }
  | { status: "slot_full" | "closed"; message: string; slots: PublicSlot[] }
  | {
      status: "duplicate_email" | "captcha_failed" | "rate_limited" | "error";
      message: string;
    };
