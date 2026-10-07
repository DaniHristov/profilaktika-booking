import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCampaign } from "@/lib/admin/campaigns";

import { LoadingText } from "../../_components/loading-text";
import { CampaignForm } from "../_components/campaign-form";

export const metadata: Metadata = { title: "Настройки на кампания – админ панел" };

export default function CampaignSettingsPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  return (
    <Suspense fallback={<LoadingText />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: PageProps<"/admin/campaigns/[id]">["params"] }) {
  const { id } = await params;
  const c = await getCampaign(id);
  if (!c) notFound();

  return (
    <CampaignForm
      campaignId={c.id}
      initial={{
        slug: c.slug,
        title: c.title,
        locationAddress: c.location_address,
        locationNote: c.location_note ?? "",
        isActive: c.is_active,
        bookingClosesHoursBefore: c.booking_closes_hours_before,
        allowPublicCancel: c.allow_public_cancel,
        cancelClosesHoursBefore: c.cancel_closes_hours_before,
      }}
    />
  );
}
