"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampaignFormInput } from "@/lib/admin/campaign-schema";
import { useHydrated } from "@/lib/use-hydrated";

import { saveCampaignAction } from "../actions";

type Props = {
  campaignId: string | null;
  initial: CampaignFormInput;
};

type Errors = Partial<Record<keyof CampaignFormInput, string>>;

export function CampaignForm({ campaignId, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<CampaignFormInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  const slugChanged = campaignId !== null && values.slug.trim().toLowerCase() !== initial.slug;

  function set<K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveCampaignAction(campaignId, values);
      if (!result.ok) {
        setErrors((result.fieldErrors ?? {}) as Errors);
        setMessage({ kind: "error", text: result.message });
        return;
      }
      if (campaignId === null) {
        router.push(`/admin/campaigns/${result.data.id}/slots`);
        return;
      }
      setMessage({ kind: "ok", text: "Промените са запазени." });
    });
  }

  const field = (
    key: keyof CampaignFormInput,
    label: string,
    input: React.ReactNode,
    hint?: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`campaign-${key}`}>{label}</Label>
      {input}
      {hint ? (
        <p id={`campaign-${key}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors[key] ? (
        <p id={`campaign-${key}-error`} className="text-sm text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  const describe = (key: keyof CampaignFormInput, hint = false) =>
    [errors[key] ? `campaign-${key}-error` : null, hint ? `campaign-${key}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form noValidate onSubmit={submit} className="flex max-w-2xl flex-col gap-5">
      {field(
        "title",
        "Заглавие",
        <Input
          id="campaign-title"
          value={values.title}
          maxLength={200}
          onChange={(e) => set("title", e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describe("title")}
        />,
      )}
      {field(
        "slug",
        "Адрес на линка",
        <Input
          id="campaign-slug"
          value={values.slug}
          maxLength={80}
          onChange={(e) => set("slug", e.target.value)}
          aria-invalid={Boolean(errors.slug)}
          aria-describedby={describe("slug", true)}
          className="font-mono"
        />,
        slugChanged
          ? "Внимание: ако смените адреса, вече изпратените линкове спират да работят."
          : "Линкът ще бъде /book/<адрес>. Малки латински букви, цифри и тирета.",
      )}
      {field(
        "locationAddress",
        "Адрес на прегледа",
        <Input
          id="campaign-locationAddress"
          value={values.locationAddress}
          maxLength={300}
          onChange={(e) => set("locationAddress", e.target.value)}
          aria-invalid={Boolean(errors.locationAddress)}
          aria-describedby={describe("locationAddress")}
        />,
      )}
      {field(
        "locationNote",
        "Уточнение за мястото (по желание)",
        <Input
          id="campaign-locationNote"
          value={values.locationNote}
          maxLength={300}
          placeholder="напр. Етаж 2, кабинет 5"
          onChange={(e) => set("locationNote", e.target.value)}
          aria-invalid={Boolean(errors.locationNote)}
          aria-describedby={describe("locationNote")}
        />,
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "bookingClosesHoursBefore",
          "Записването спира (часа преди прегледа)",
          <Input
            id="campaign-bookingClosesHoursBefore"
            type="number"
            min={0}
            max={720}
            inputMode="numeric"
            value={String(values.bookingClosesHoursBefore)}
            onChange={(e) => set("bookingClosesHoursBefore", e.target.value)}
            aria-invalid={Boolean(errors.bookingClosesHoursBefore)}
            aria-describedby={describe("bookingClosesHoursBefore")}
          />,
        )}
        {field(
          "cancelClosesHoursBefore",
          "Онлайн отмяната спира (часа преди прегледа)",
          <Input
            id="campaign-cancelClosesHoursBefore"
            type="number"
            min={0}
            max={720}
            inputMode="numeric"
            value={String(values.cancelClosesHoursBefore)}
            onChange={(e) => set("cancelClosesHoursBefore", e.target.value)}
            aria-invalid={Boolean(errors.cancelClosesHoursBefore)}
            aria-describedby={describe("cancelClosesHoursBefore", true)}
            disabled={!values.allowPublicCancel}
          />,
          "0 = до началото на часа.",
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <Checkbox
            checked={values.isActive}
            onCheckedChange={(v) => set("isActive", v === true)}
            className="mt-0.5"
          />
          <span>
            Кампанията е активна
            <span className="block text-sm text-muted-foreground">
              Неактивна кампания показва „Записването е затворено“.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <Checkbox
            checked={values.allowPublicCancel}
            onCheckedChange={(v) => set("allowPublicCancel", v === true)}
            className="mt-0.5"
          />
          <span>
            Служителите могат да отменят онлайн
            <span className="block text-sm text-muted-foreground">
              Ако е изключено, имейлът няма линк за отмяна и служителите се свързват с центъра.
            </span>
          </span>
        </label>
      </div>

      <div
        role={message?.kind === "error" ? "alert" : "status"}
        className={
          message
            ? message.kind === "error"
              ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
              : "rounded-lg bg-muted px-3 py-2"
            : "sr-only"
        }
      >
        {message?.text}
      </div>

      <div>
        <Button type="submit" disabled={isPending || !hydrated}>
          {isPending ? "Запазване…" : campaignId ? "Запази промените" : "Създай кампанията"}
        </Button>
      </div>
    </form>
  );
}
