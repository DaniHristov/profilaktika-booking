"use client";

import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { buildIcs } from "@/lib/calendar/ics";
import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import type { BookingConfirmation } from "@/lib/booking/types";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";

function downloadIcs(confirmation: BookingConfirmation) {
  const location = [confirmation.locationAddress, confirmation.locationNote]
    .filter(Boolean)
    .join(", ");
  const ics = buildIcs({
    uid: `${confirmation.bookingId}@profilaktika-booking`,
    start: new Date(confirmation.startsAt),
    durationMin: confirmation.durationMin,
    summary: confirmation.title,
    location,
  });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "profilaktichen-pregled.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function Confirmation({ confirmation }: { confirmation: BookingConfirmation }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const start = new Date(confirmation.startsAt);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="confirmation-heading"
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-600" />
        <h2
          id="confirmation-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {BOOKING_MESSAGES.success}
        </h2>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
        <dt className="text-muted-foreground">Дата</dt>
        <dd>
          {formatDate(start)} <span className="text-muted-foreground">({formatWeekday(start)})</span>
        </dd>
        <dt className="text-muted-foreground">Час</dt>
        <dd className="tabular-nums">{formatTime(start)}</dd>
        <dt className="text-muted-foreground">Адрес</dt>
        <dd>
          {confirmation.locationAddress}
          {confirmation.locationNote ? (
            <span className="block text-muted-foreground">{confirmation.locationNote}</span>
          ) : null}
        </dd>
      </dl>

      <div>
        <Button size="lg" className="h-11 px-4 text-base" onClick={() => downloadIcs(confirmation)}>
          <CalendarPlus aria-hidden="true" />
          Добави в календар
        </Button>
      </div>
    </section>
  );
}
