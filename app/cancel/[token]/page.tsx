import type { Metadata } from "next";
import { Suspense } from "react";

import { CANCEL_MESSAGES } from "@/lib/booking/cancel-messages";
import { getCancelView } from "@/lib/booking/cancel";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

import { CancelPanel } from "./_components/cancel-panel";

export const metadata: Metadata = {
  title: CANCEL_MESSAGES.title,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Opening this page never cancels anything: email security scanners open
// links automatically. Cancelling requires pressing the button (POST).
export default function CancelPage({ params }: PageProps<"/cancel/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{CANCEL_MESSAGES.title}</h1>
      <Suspense
        fallback={
          <p role="status" className="text-muted-foreground">
            Зареждане…
          </p>
        }
      >
        <CancelContent params={params} />
      </Suspense>
    </main>
  );
}

async function CancelContent({ params }: { params: PageProps<"/cancel/[token]">["params"] }) {
  const { token } = await params;
  const view = await getCancelView(createAdminClient(), token);

  if (!view) {
    return <p className="rounded-xl border border-border p-5 text-base">{CANCEL_MESSAGES.notFound}</p>;
  }

  const start = new Date(view.startsAt);
  return (
    <>
      <section aria-label="Данни за записването" className="flex flex-col gap-3 rounded-xl bg-muted p-5">
        <p className="text-base font-semibold">{view.campaignTitle}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt className="text-muted-foreground">Име</dt>
          <dd>{view.fullName}</dd>
          <dt className="text-muted-foreground">Дата</dt>
          <dd>
            {formatDate(start)} <span className="text-muted-foreground">({formatWeekday(start)})</span>
          </dd>
          <dt className="text-muted-foreground">Час</dt>
          <dd className="tabular-nums">{formatTime(start)}</dd>
          <dt className="text-muted-foreground">Адрес</dt>
          <dd>
            {view.locationAddress}
            {view.locationNote ? <span className="block text-muted-foreground">{view.locationNote}</span> : null}
          </dd>
        </dl>
      </section>
      <CancelPanel token={token} state={view.state} />
    </>
  );
}
