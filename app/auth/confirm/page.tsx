import type { Metadata } from "next";
import { Suspense } from "react";

import { ConfirmButton } from "./confirm-button";

export const metadata: Metadata = {
  title: "Вход – админ панел",
  referrer: "no-referrer",
};

// The link from the email only opens this page. Signing in needs a button
// press: email security scanners open links automatically and would otherwise
// spend the one-time token.
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Вход в админ панела</h1>
      <Suspense fallback={null}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ConfirmContent({
  searchParams,
}: {
  searchParams: PageProps<"/auth/confirm">["searchParams"];
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  if (!tokenHash) {
    return (
      <p className="text-base">
        Линкът за вход е непълен. Моля, отворете го изцяло от имейла или поискайте нов.
      </p>
    );
  }
  return <ConfirmButton tokenHash={tokenHash} />;
}
