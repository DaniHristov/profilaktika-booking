import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listCampaignOptions, listFreeSlots } from "@/lib/admin/bookings";

import { LoadingText } from "../../_components/loading-text";
import { AdminBookingForm } from "../_components/admin-booking-form";

export const metadata: Metadata = { title: "Ново записване – админ панел" };

export default function NewBookingPage({ searchParams }: PageProps<"/admin/bookings/new">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:underline">
          ← Записвания
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ново записване</h1>
        <p className="text-sm text-muted-foreground">
          Например след телефонно обаждане. Важат същите правила за свободни места.
        </p>
      </div>
      <Suspense fallback={<LoadingText />}>
        <NewBooking searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewBooking({ searchParams }: { searchParams: PageProps<"/admin/bookings/new">["searchParams"] }) {
  const { campaign } = await searchParams;
  const campaigns = await listCampaignOptions();
  const selected = campaigns.find((c) => c.id === campaign)?.id ?? (campaigns.length === 1 ? campaigns[0].id : null);
  const slots = selected ? await listFreeSlots(selected) : [];

  return (
    <>
      <form method="get" className="flex max-w-2xl flex-wrap items-end gap-2">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="new-campaign">Кампания</Label>
          <select
            id="new-campaign"
            name="campaign"
            defaultValue={selected ?? ""}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Изберете кампания…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Покажи часовете
        </Button>
      </form>

      {selected ? (
        slots.length > 0 ? (
          <AdminBookingForm key={selected} slots={slots} />
        ) : (
          <p className="text-base text-muted-foreground">Няма свободни бъдещи часове в тази кампания.</p>
        )
      ) : null}
    </>
  );
}
