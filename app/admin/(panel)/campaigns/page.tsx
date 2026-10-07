import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCampaigns } from "@/lib/admin/campaigns";

import { LoadingText } from "../_components/loading-text";

export const metadata: Metadata = { title: "Кампании – админ панел" };

export default function CampaignsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Кампании</h1>
        <Button asChild>
          <Link href="/admin/campaigns/new">Нова кампания</Link>
        </Button>
      </div>
      <Suspense fallback={<LoadingText />}>
        <CampaignList />
      </Suspense>
    </div>
  );
}

async function CampaignList() {
  const campaigns = await listCampaigns();
  return (
    <>
      {campaigns.length === 0 ? (
        <p className="text-base text-muted-foreground">Все още няма кампании.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Заглавие</TableHead>
              <TableHead>Линк</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Предстоящи часове</TableHead>
              <TableHead className="text-right">Предстоящи записвания</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/campaigns/${c.id}`} className="underline-offset-4 hover:underline">
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">/book/{c.slug}</TableCell>
                <TableCell>
                  {c.is_active ? <Badge>Активна</Badge> : <Badge variant="outline">Неактивна</Badge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.upcoming_slots}</TableCell>
                <TableCell className="text-right tabular-nums">{c.upcoming_bookings}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
