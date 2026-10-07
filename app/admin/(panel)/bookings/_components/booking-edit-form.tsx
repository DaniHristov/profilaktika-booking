"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOOKING_LIMITS } from "@/lib/validation/booking";
import { useHydrated } from "@/lib/use-hydrated";

import { updateBookingAction } from "../actions";

type Values = { fullName: string; phone: string; email: string; workplace: string; notes: string };

export function BookingEditForm({ bookingId, initial }: { bookingId: string; initial: Values }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();

  const set = (key: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const field = (key: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Input
        id={`edit-${key}`}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `edit-${key}-error` : undefined}
        {...props}
      />
      {errors[key] ? (
        <p id={`edit-${key}-error`} className="text-sm text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await updateBookingAction(bookingId, values);
          if (result.ok) setMessage({ kind: "ok", text: "Промените са запазени." });
          else {
            setErrors(result.fieldErrors ?? {});
            setMessage({ kind: "error", text: result.message });
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("fullName", "Име и фамилия", { maxLength: BOOKING_LIMITS.fullName, autoComplete: "off" })}
        {field("phone", "Телефон", { type: "tel", maxLength: 30, autoComplete: "off" })}
        {field("email", "Имейл", { type: "email", maxLength: BOOKING_LIMITS.email, autoComplete: "off" })}
        {field("workplace", "Работно място", { maxLength: BOOKING_LIMITS.workplace, autoComplete: "off" })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-notes">Допълнително</Label>
        <Textarea
          id="edit-notes"
          rows={3}
          maxLength={BOOKING_LIMITS.notes}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? "edit-notes-error" : undefined}
        />
        {errors.notes ? (
          <p id="edit-notes-error" className="text-sm text-destructive">
            {errors.notes}
          </p>
        ) : null}
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
      <p className="text-sm text-muted-foreground">Служителят не получава имейл при промяна на данните.</p>
      <div>
        <Button type="submit" disabled={isPending || !hydrated}>
          {isPending ? "Запазване…" : "Запази данните"}
        </Button>
      </div>
    </form>
  );
}
