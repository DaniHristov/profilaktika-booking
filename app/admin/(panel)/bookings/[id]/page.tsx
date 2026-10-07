import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { getBooking, listFreeSlots } from "@/lib/admin/bookings";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";
import { formatPhone } from "@/lib/format/phone";

import { LoadingText } from "../../_components/loading-text";
import { BookingEditForm } from "../_components/booking-edit-form";
import { BookingCancel, BookingMove } from "../_components/booking-move-cancel";

export const metadata: Metadata = { title: "Записване – админ панел" };

export default function BookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:underline">
        ← Записвания
      </Link>
      <Suspense fallback={<LoadingText />}>
        <BookingDetails params={params} />
      </Suspense>
    </div>
  );
}

function dateTime(value: string) {
  const d = new Date(value);
  return `${formatDate(d)} ${formatTime(d)}`;
}

async function BookingDetails({ params }: { params: PageProps<"/admin/bookings/[id]">["params"] }) {
  const { id } = await params;
  const booking = await getBooking(id);
  if (!booking) notFound();

  const confirmed = booking.status === "confirmed";
  const targets = confirmed ? await listFreeSlots(booking.campaign_id, booking.slot_id) : [];
  const start = new Date(booking.starts_at);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{booking.full_name}</h1>
          {confirmed ? <Badge>Потвърден</Badge> : <Badge variant="outline">Отменен</Badge>}
          {booking.source === "admin" ? <Badge variant="secondary">Въведено от админ</Badge> : null}
        </div>
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Кампания</dt>
          <dd>{booking.campaign_title}</dd>
          <dt className="text-muted-foreground">Час</dt>
          <dd className="font-medium">
            {formatDate(start)} ({formatWeekday(start)}) {formatTime(start)}, {booking.duration_min} мин
          </dd>
          <dt className="text-muted-foreground">Телефон</dt>
          <dd>{formatPhone(booking.phone)}</dd>
          <dt className="text-muted-foreground">Записан на</dt>
          <dd>{dateTime(booking.created_at)}</dd>
          <dt className="text-muted-foreground">Имейл за потвърждение</dt>
          <dd>
            {!booking.email
              ? "няма имейл"
              : booking.confirmation_sent_at
                ? `изпратен ${dateTime(booking.confirmation_sent_at)}`
                : "не е изпратен"}
          </dd>
        </dl>
      </div>

      <section aria-labelledby="edit-heading" className="flex flex-col gap-3 rounded-xl border border-border p-5">
        <h2 id="edit-heading" className="text-lg font-semibold">
          Данни на служителя
        </h2>
        <BookingEditForm
          bookingId={booking.id}
          initial={{
            fullName: booking.full_name,
            phone: formatPhone(booking.phone),
            email: booking.email ?? "",
            workplace: booking.workplace ?? "",
            notes: booking.notes ?? "",
          }}
        />
      </section>

      {confirmed ? (
        <>
          <section aria-labelledby="move-heading" className="flex flex-col gap-3 rounded-xl border border-border p-5">
            <h2 id="move-heading" className="text-lg font-semibold">
              Преместване в друг час
            </h2>
            <BookingMove bookingId={booking.id} targets={targets} hasEmail={Boolean(booking.email)} />
          </section>
          <section aria-labelledby="cancel-heading" className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-5">
            <h2 id="cancel-heading" className="text-lg font-semibold">
              Отмяна
            </h2>
            <BookingCancel bookingId={booking.id} label={booking.full_name} hasEmail={Boolean(booking.email)} />
          </section>
        </>
      ) : null}
    </>
  );
}
