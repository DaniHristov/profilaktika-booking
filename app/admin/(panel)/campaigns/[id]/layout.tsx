import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { getCampaign } from "@/lib/admin/campaigns";

import { CampaignTabs } from "../_components/campaign-tabs";
import { CopyLinkButton } from "../_components/copy-link-button";

export default function CampaignLayout({ params, children }: LayoutProps<"/admin/campaigns/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← Кампании
        </Link>
        <Suspense fallback={<div className="h-16" aria-hidden="true" />}>
          <CampaignHeader params={params} />
        </Suspense>
      </div>
      <CampaignTabs />
      {children}
    </div>
  );
}

async function CampaignHeader({ params }: { params: LayoutProps<"/admin/campaigns/[id]">["params"] }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1>
        {campaign.is_active ? <Badge>Активна</Badge> : <Badge variant="outline">Неактивна</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="font-mono text-sm text-muted-foreground">/book/{campaign.slug}</span>
        <CopyLinkButton slug={campaign.slug} />
        <Link href={`/book/${campaign.slug}`} target="_blank" className="text-sm underline underline-offset-4">
          Отвори публичната страница
        </Link>
      </div>
    </>
  );
}
