import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCampaign, listSlots, type SlotRow } from "@/lib/admin/campaigns";
import { dateKey, formatDate, formatTime, formatWeekday } from "@/lib/datetime";

import { LoadingText } from "../../../_components/loading-text";
import { SlotGenerator } from "../../_components/slot-generator";
import { SlotRowActions } from "../../_components/slot-row-actions";

export const metadata: Metadata = { title: "Часове – админ панел" };

function slotStatus(slot: SlotRow) {
  if (slot.is_blocked) return <Badge variant="outline">Блокиран</Badge>;
  if (slot.confirmed_count >= slot.capacity) return <Badge variant="secondary">Пълен</Badge>;
  return <Badge>Свободен</Badge>;
}

type Props = PageProps<"/admin/campaigns/[id]/slots">;

export default function CampaignSlotsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<LoadingText />}>
      <Slots params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Slots({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { id } = await params;
  const { past } = await searchParams;
  const includePast = past === "1";

  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const slots = await listSlots(id, includePast);

  const days = new Map<string, SlotRow[]>();
  for (const slot of slots) {
    const key = dateKey(new Date(slot.starts_at));
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  const today = dateKey(new Date());

  return (
    <div className="flex flex-col gap-8">
      <SlotGenerator campaignId={id} today={today} />

      <section aria-labelledby="slots-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="slots-heading" className="text-lg font-semibold">
            {includePast ? "Всички часове" : "Предстоящи часове"} ({slots.length})
          </h2>
          <Link
            href={includePast ? `/admin/campaigns/${id}/slots` : `/admin/campaigns/${id}/slots?past=1`}
            className="text-sm underline underline-offset-4"
          >
            {includePast ? "Само предстоящи" : "Покажи и минали"}
          </Link>
        </div>

        {slots.length === 0 ? (
          <p className="text-base text-muted-foreground">Няма часове. Използвайте генератора по-горе.</p>
        ) : (
          [...days.entries()].map(([key, daySlots]) => {
            const date = new Date(daySlots[0].starts_at);
            return (
              <div key={key} className="flex flex-col gap-1">
                <h3 className="text-base font-medium">
                  {formatDate(date)} <span className="text-muted-foreground">({formatWeekday(date)})</span>
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Час</TableHead>
                      <TableHead className="w-24">Статус</TableHead>
                      <TableHead className="w-32 text-right">Записани / места</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daySlots.map((slot) => {
                      const start = new Date(slot.starts_at);
                      const label = `${formatDate(start)} ${formatTime(start)}`;
                      return (
                        <TableRow key={slot.id}>
                          <TableCell className="font-medium tabular-nums">
                            {formatTime(start)}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {slot.duration_min} мин
                            </span>
                          </TableCell>
                          <TableCell>{slotStatus(slot)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {slot.confirmed_count} / {slot.capacity}
                          </TableCell>
                          <TableCell className="text-right">
                            <SlotRowActions
                              slotId={slot.id}
                              label={label}
                              isBlocked={slot.is_blocked}
                              capacity={slot.capacity}
                              confirmedCount={slot.confirmed_count}
                              totalBookings={slot.total_bookings}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
