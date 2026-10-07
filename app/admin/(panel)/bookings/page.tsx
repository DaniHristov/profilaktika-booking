import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BOOKINGS_PAGE_SIZE,
  bookingFiltersToQuery,
  parseBookingFilters,
  type BookingFilters,
} from "@/lib/admin/booking-filters";
import { listBookings, listCampaignOptions } from "@/lib/admin/bookings";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatPhone } from "@/lib/format/phone";

import { LoadingText } from "../_components/loading-text";

export const metadata: Metadata = { title: "Записвания – админ панел" };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Записвания</h1>
      <Suspense fallback={<LoadingText />}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Bookings({ searchParams }: { searchParams: PageProps<"/admin/bookings">["searchParams"] }) {
  const filters = parseBookingFilters(await searchParams);
  const [campaigns, { rows, total }] = await Promise.all([listCampaignOptions(), listBookings(filters)]);
  const showCampaign = !filters.campaignId && campaigns.length > 1;
  const from = total === 0 ? 0 : (filters.page - 1) * BOOKINGS_PAGE_SIZE + 1;
  const to = Math.min(filters.page * BOOKINGS_PAGE_SIZE, total);
  const lastPage = Math.max(1, Math.ceil(total / BOOKINGS_PAGE_SIZE));

  return (
    <>
      <Filters filters={filters} campaigns={campaigns} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {total === 0 ? "Няма записвания по тези филтри." : `Показани ${from}–${to} от ${total}`}
        </p>
      </div>

      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Час</TableHead>
              <TableHead>Име и фамилия</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Имейл</TableHead>
              <TableHead>Работно място</TableHead>
              {showCampaign ? <TableHead>Кампания</TableHead> : null}
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => {
              const start = new Date(b.starts_at);
              return (
                <TableRow key={b.id}>
                  <TableCell className="tabular-nums">{formatDate(start)}</TableCell>
                  <TableCell className="tabular-nums">{formatTime(start)}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/admin/bookings/${b.id}`} className="underline-offset-4 hover:underline">
                      {b.full_name}
                    </Link>
                    {b.notes ? (
                      <span className="block max-w-xs truncate text-xs font-normal text-muted-foreground" title={b.notes}>
                        {b.notes}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatPhone(b.phone)}</TableCell>
                  <TableCell>{b.email}</TableCell>
                  <TableCell>{b.workplace ?? ""}</TableCell>
                  {showCampaign ? <TableCell>{b.campaign_title}</TableCell> : null}
                  <TableCell>
                    {b.status === "confirmed" ? <Badge>Потвърден</Badge> : <Badge variant="outline">Отменен</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}

      {lastPage > 1 ? (
        <nav aria-label="Страници" className="flex items-center gap-2">
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/bookings${bookingFiltersToQuery(filters, { page: filters.page - 1 })}`}>← Предишна</Link>
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Страница {filters.page} от {lastPage}
          </span>
          {filters.page < lastPage ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/bookings${bookingFiltersToQuery(filters, { page: filters.page + 1 })}`}>Следваща →</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

function Filters({ filters, campaigns }: { filters: BookingFilters; campaigns: { id: string; title: string }[] }) {
  return (
    <form method="get" action="/admin/bookings" className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="f-q">Търсене</Label>
        <Input id="f-q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Име, телефон или имейл" maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="f-campaign">Кампания</Label>
        <select id="f-campaign" name="campaign" defaultValue={filters.campaignId ?? ""} className={selectClass}>
          <option value="">Всички кампании</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-date">Дата</Label>
        <Input id="f-date" name="date" type="date" defaultValue={filters.date ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-time">Час</Label>
        <Input id="f-time" name="time" type="time" step={300} defaultValue={filters.time ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-status">Статус</Label>
        <select id="f-status" name="status" defaultValue={filters.status} className={selectClass}>
          <option value="confirmed">Потвърдени</option>
          <option value="cancelled">Отменени</option>
          <option value="all">Всички</option>
        </select>
      </div>
      <div className="flex items-end gap-2 lg:col-span-5">
        <Button type="submit">Приложи</Button>
        <Button asChild variant="ghost">
          <Link href="/admin/bookings">Изчисти</Link>
        </Button>
      </div>
    </form>
  );
}
