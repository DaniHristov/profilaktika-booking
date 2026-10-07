import type { Metadata } from "next";
import Link from "next/link";

import { CampaignForm } from "../_components/campaign-form";

export const metadata: Metadata = { title: "Нова кампания – админ панел" };

export default function NewCampaignPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← Кампании
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Нова кампания</h1>
      </div>
      <CampaignForm
        campaignId={null}
        initial={{
          slug: "",
          title: "Профилактични прегледи – Медицински център",
          locationAddress: "",
          locationNote: "",
          isActive: true,
          bookingClosesHoursBefore: 2,
          allowPublicCancel: true,
          cancelClosesHoursBefore: 0,
        }}
      />
    </div>
  );
}
