"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FreeSlot } from "@/lib/admin/bookings";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";
import { BOOKING_LIMITS } from "@/lib/validation/booking";
import { useHydrated } from "@/lib/use-hydrated";

import { createAdminBookingAction } from "../actions";

type Values = {
  slotId: string;
  fullName: string;
  phone: string;
  email: string;
  workplace: string;
  notes: string;
  oralConsent: boolean;
};

export function AdminBookingForm({ slots }: { slots: FreeSlot[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    slotId: "",
    fullName: "",
    phone: "",
    email: "",
    workplace: "",
    notes: "",
    oralConsent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  const err = (key: string) =>
    errors[key] ? (
      <p id={`new-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  const text = (key: "fullName" | "phone" | "email" | "workplace", label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`new-${key}`}>{label}</Label>
      <Input
        id={`new-${key}`}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `new-${key}-error` : undefined}
        autoComplete="off"
        {...props}
      />
      {err(key)}
    </div>
  );

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await createAdminBookingAction(values);
          if (result.ok) {
            router.push(`/admin/bookings/${result.data.id}`);
            return;
          }
          setErrors(result.fieldErrors ?? {});
          setMessage(result.message);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-slotId">Час</Label>
        <select
          id="new-slotId"
          value={values.slotId}
          onChange={(e) => set("slotId", e.target.value)}
          aria-invalid={Boolean(errors.slotId)}
          aria-describedby={errors.slotId ? "new-slotId-error" : undefined}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Изберете час…</option>
          {slots.map((s) => {
            const d = new Date(s.startsAt);
            return (
              <option key={s.id} value={s.id}>
                {formatDate(d)} ({formatWeekday(d)}) {formatTime(d)}
                {s.free > 1 ? ` – ${s.free} свободни места` : ""}
              </option>
            );
          })}
        </select>
        {err("slotId")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {text("fullName", "Име и фамилия", { maxLength: BOOKING_LIMITS.fullName })}
        {text("phone", "Телефон", { type: "tel", maxLength: 30 })}
        {text("email", "Имейл (по желание)", { type: "email", maxLength: BOOKING_LIMITS.email })}
        {text("workplace", "Работно място", { maxLength: BOOKING_LIMITS.workplace })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-notes">Допълнително</Label>
        <Textarea
          id="new-notes"
          rows={3}
          maxLength={BOOKING_LIMITS.notes}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? "new-notes-error" : undefined}
        />
        {err("notes")}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Checkbox
            id="new-oralConsent"
            checked={values.oralConsent}
            onCheckedChange={(v) => set("oralConsent", v === true)}
            aria-invalid={Boolean(errors.oralConsent)}
            aria-describedby={errors.oralConsent ? "new-oralConsent-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="new-oralConsent" className="font-normal">
            Служителят е дал устно съгласие за обработка на личните данни
          </Label>
        </div>
        {err("oralConsent")}
      </div>

      <p className="text-sm text-muted-foreground">
        Ако е въведен имейл, служителят ще получи потвърждение с линк за отмяна.
      </p>

      <div role="alert" className={message ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive" : "sr-only"}>
        {message}
      </div>

      <div>
        <Button type="submit" disabled={isPending || !hydrated}>
          {isPending ? "Записване…" : "Запиши"}
        </Button>
      </div>
    </form>
  );
}
