import "server-only";

import { render } from "@react-email/components";
import { createElement } from "react";

import { buildIcs } from "@/lib/calendar/ics";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";
import { BookingCancelledEmail } from "@/lib/email/templates/booking-cancelled";
import { BookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { BookingMovedEmail } from "@/lib/email/templates/booking-moved";
import type { EmailMessage } from "@/lib/email/transport";

export type BookingEmailData = {
  bookingId: string;
  fullName: string;
  email: string;
  startsAt: Date;
  durationMin: number;
  campaignTitle: string;
  locationAddress: string;
  locationNote: string | null;
};

function details(data: BookingEmailData) {
  return {
    date: formatDate(data.startsAt),
    weekday: formatWeekday(data.startsAt),
    time: formatTime(data.startsAt),
    address: data.locationAddress,
    addressNote: data.locationNote,
  };
}

// Changes after the original confirmation (move, cancel) get an increasing
// sequence so calendars that do apply updates take the newest one.
function revision(): number {
  return Math.floor(Date.now() / 1000);
}

function calendarAttachment(data: BookingEmailData, method: "PUBLISH" | "CANCEL", sequence?: number) {
  return {
    filename: method === "CANCEL" ? "otmenen-pregled.ics" : "profilaktichen-pregled.ics",
    content: buildIcs({
      // Same UID as the confirmation page download, so calendars match them.
      uid: `${data.bookingId}@profilaktika-booking`,
      start: data.startsAt,
      durationMin: data.durationMin,
      summary: data.campaignTitle,
      location: [data.locationAddress, data.locationNote].filter(Boolean).join(", "),
      method,
      sequence,
    }),
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}

export function cancelUrlFor(appUrl: string, cancelToken: string): string {
  return new URL(`/cancel/${cancelToken}`, appUrl).toString();
}

export async function buildConfirmationEmail(
  data: BookingEmailData,
  cancelUrl: string | null,
): Promise<EmailMessage> {
  const element = createElement(BookingConfirmationEmail, {
    fullName: data.fullName,
    campaignTitle: data.campaignTitle,
    details: details(data),
    cancelUrl,
  });
  return {
    to: data.email,
    subject: `Потвърждение: профилактичен преглед на ${formatDate(data.startsAt)} от ${formatTime(data.startsAt)}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
    attachments: [calendarAttachment(data, "PUBLISH")],
    idempotencyKey: `booking-confirmation/${data.bookingId}`,
  };
}

export async function buildCancellationEmail(data: BookingEmailData): Promise<EmailMessage> {
  const element = createElement(BookingCancelledEmail, {
    fullName: data.fullName,
    campaignTitle: data.campaignTitle,
    details: details(data),
  });
  return {
    to: data.email,
    subject: `Отменено: профилактичен преглед на ${formatDate(data.startsAt)} от ${formatTime(data.startsAt)}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
    attachments: [calendarAttachment(data, "CANCEL", revision())],
    idempotencyKey: `booking-cancellation/${data.bookingId}`,
  };
}

export async function buildMovedEmail(
  data: BookingEmailData,
  cancelUrl: string | null,
): Promise<EmailMessage> {
  const element = createElement(BookingMovedEmail, {
    fullName: data.fullName,
    campaignTitle: data.campaignTitle,
    details: details(data),
    cancelUrl,
  });
  return {
    to: data.email,
    subject: `Промяна на час: профилактичен преглед на ${formatDate(data.startsAt)} от ${formatTime(data.startsAt)}`,
    html: await render(element),
    text: await render(element, { plainText: true }),
    attachments: [calendarAttachment(data, "PUBLISH", revision())],
    // One email per target time, so retrying the same move does not resend.
    idempotencyKey: `booking-moved/${data.bookingId}/${data.startsAt.toISOString()}`,
  };
}
