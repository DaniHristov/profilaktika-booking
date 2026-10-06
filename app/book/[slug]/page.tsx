import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import { getAvailability, getPublicCampaign } from "@/lib/booking/queries";
import { getPublicTurnstileEnv } from "@/lib/env";

import { BookingFlow } from "./_components/booking-flow";

export default function BookPage({ params }: PageProps<"/book/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      {/* Availability must always be fresh, so everything below is request-time. */}
      <Suspense fallback={<BookingSkeleton />}>
        <BookingContent params={params} />
      </Suspense>
    </main>
  );
}

async function BookingContent({ params }: { params: PageProps<"/book/[slug]">["params"] }) {
  const { slug } = await params;
  const campaign = await getPublicCampaign(slug);
  if (!campaign) notFound();

  const header = (
    <header className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {campaign.title}
      </h1>
      <p className="flex items-start gap-2 text-base text-muted-foreground">
        <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>
          <span className="sr-only">Адрес: </span>
          {campaign.locationAddress}
          {campaign.locationNote ? <span className="block">{campaign.locationNote}</span> : null}
        </span>
      </p>
    </header>
  );

  if (!campaign.isActive) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-border p-5 text-base">
          {BOOKING_MESSAGES.campaignClosed}
        </p>
      </>
    );
  }

  const slots = await getAvailability(slug);
  const { NEXT_PUBLIC_TURNSTILE_SITE_KEY } = getPublicTurnstileEnv();

  return (
    <>
      {header}
      <BookingFlow slug={slug} initialSlots={slots} turnstileSiteKey={NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </>
  );
}

function BookingSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Зареждане…
      </p>
      <div className="h-9 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-5 w-1/2 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
