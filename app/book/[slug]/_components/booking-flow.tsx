"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { groupSlotsByDay } from "@/lib/booking/group";
import { BOOKING_MESSAGES } from "@/lib/booking/messages";
import type { BookingConfirmation, PublicSlot } from "@/lib/booking/types";
import { formatDate, formatTime, formatWeekday } from "@/lib/datetime";
import {
  BOOKING_LIMITS,
  bookingFormSchema,
  type BookingField,
} from "@/lib/validation/booking";

import { bookSlotAction, refreshAvailabilityAction } from "../actions";
import { Confirmation } from "./confirmation";
import { SlotPicker } from "./slot-picker";
import { Turnstile, type TurnstileHandle } from "./turnstile";

type Props = {
  slug: string;
  initialSlots: PublicSlot[];
  turnstileSiteKey: string;
};

type FormValues = {
  fullName: string;
  phone: string;
  email: string;
  workplace: string;
  notes: string;
  consent: boolean;
};

type FieldErrors = Partial<Record<BookingField, string>>;

const EMPTY_FORM: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  workplace: "",
  notes: "",
  consent: false,
};

// Order in which fields appear, for focusing the first invalid one.
const FIELD_ORDER: BookingField[] = ["slotId", "fullName", "phone", "email", "workplace", "notes", "consent"];

const inputClass = "h-11 text-base md:text-base";

const noopSubscribe = () => () => {};

// False during SSR and before hydration. Inputs stay disabled until then, so a
// tap or keystroke on a slow phone can not land in the DOM without React
// knowing about it.
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function BookingFlow({ slug, initialSlots, turnstileSiteKey }: Props) {
  const [slots, setSlots] = useState(initialSlots);
  const days = useMemo(() => groupSlotsByDay(slots), [slots]);

  const [chosenDayKey, setChosenDayKey] = useState<string | null>(null);
  const [chosenSlotId, setChosenSlotId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const locked = isPending || !hydrated;

  const turnstileRef = useRef<TurnstileHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Derived selection: falls back to the first day with free slots, and drops a
  // chosen slot that is no longer free after a refresh.
  const selectedDayKey = days.some((d) => d.key === chosenDayKey)
    ? chosenDayKey
    : (days[0]?.key ?? null);
  const selectedSlot =
    slots.find((s) => s.id === chosenSlotId && s.available) ?? null;

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function focusFirstError(errors: FieldErrors) {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (!first) return;
    const target = first === "slotId" ? "booking-slot-summary" : `booking-${first}`;
    document.getElementById(target)?.focus();
  }

  function showMessage(message: string) {
    setFormMessage(message);
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  function selectSlot(slotId: string) {
    setChosenSlotId(slotId);
    setFieldErrors((current) => ({ ...current, slotId: undefined }));
    setFormMessage(null);
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setFormMessage(null);

    const input = { slotId: selectedSlot?.id ?? "", ...values };
    const parsed = bookingFormSchema.safeParse(input);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as BookingField;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }
    if (!turnstileToken) {
      showMessage(BOOKING_MESSAGES.captchaMissing);
      return;
    }

    startTransition(async () => {
      const result = await bookSlotAction(slug, input, turnstileToken);
      // Turnstile tokens are single-use.
      turnstileRef.current?.reset();

      switch (result.status) {
        case "success":
          setConfirmation(result.confirmation);
          window.scrollTo({ top: 0 });
          return;
        case "invalid":
          setFieldErrors(result.fieldErrors);
          focusFirstError(result.fieldErrors);
          return;
        case "slot_full":
        case "closed":
          setSlots(result.slots);
          setChosenSlotId(null);
          showMessage(result.message);
          return;
        default:
          showMessage(result.message);
      }
    });
  }

  async function reloadSlots() {
    const fresh = await refreshAvailabilityAction(slug);
    if (fresh) setSlots(fresh);
  }

  if (confirmation) {
    return <Confirmation confirmation={confirmation} />;
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-5">
        <p className="text-base">{BOOKING_MESSAGES.noSlots}</p>
        <Button variant="outline" onClick={() => startTransition(reloadSlots)} disabled={isPending}>
          Провери отново
        </Button>
      </div>
    );
  }

  const describedBy = (field: BookingField, extra?: string) =>
    [fieldErrors[field] ? `booking-${field}-error` : null, extra].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-8">
      <SlotPicker
        days={days}
        selectedDayKey={selectedDayKey}
        selectedSlotId={selectedSlot?.id ?? null}
        onSelectDay={(key) => {
          setChosenDayKey(key);
          setFormMessage(null);
        }}
        onSelectSlot={selectSlot}
        disabled={locked}
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby="booking-form-heading"
        className="flex scroll-mt-4 flex-col gap-5"
      >
        <h2 id="booking-form-heading" className="text-base font-semibold">
          3. Вашите данни
        </h2>
        <fieldset disabled={locked} className="contents">

        <p
          id="booking-slot-summary"
          tabIndex={-1}
          aria-describedby={describedBy("slotId")}
          className="rounded-lg bg-muted px-3 py-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {selectedSlot ? (
            <>
              Избран час:{" "}
              <strong className="font-semibold">
                {formatWeekday(new Date(selectedSlot.startsAt))},{" "}
                {formatDate(new Date(selectedSlot.startsAt))}, {formatTime(new Date(selectedSlot.startsAt))}
              </strong>
            </>
          ) : (
            <span className="text-muted-foreground">Все още не сте избрали час.</span>
          )}
        </p>
        <FieldError field="slotId" error={fieldErrors.slotId} />

        <Field label="Име и фамилия" field="fullName" required error={fieldErrors.fullName}>
          <Input
            id="booking-fullName"
            name="fullName"
            autoComplete="name"
            maxLength={BOOKING_LIMITS.fullName}
            value={values.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby={describedBy("fullName")}
            aria-required="true"
            className={inputClass}
          />
        </Field>

        <Field label="Телефон" field="phone" required error={fieldErrors.phone} hint="Например 0888 123 456">
          <Input
            id="booking-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            value={values.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={describedBy("phone", "booking-phone-hint")}
            aria-required="true"
            className={inputClass}
          />
        </Field>

        <Field label="Имейл" field="email" required error={fieldErrors.email}>
          <Input
            id="booking-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={BOOKING_LIMITS.email}
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={describedBy("email")}
            aria-required="true"
            className={inputClass}
          />
        </Field>

        <Field label="Работно място" field="workplace" error={fieldErrors.workplace}>
          <Input
            id="booking-workplace"
            name="workplace"
            autoComplete="organization"
            maxLength={BOOKING_LIMITS.workplace}
            value={values.workplace}
            onChange={(e) => updateField("workplace", e.target.value)}
            aria-invalid={Boolean(fieldErrors.workplace)}
            aria-describedby={describedBy("workplace")}
            className={inputClass}
          />
        </Field>

        <Field label="Допълнително" field="notes" error={fieldErrors.notes}>
          <Textarea
            id="booking-notes"
            name="notes"
            rows={3}
            maxLength={BOOKING_LIMITS.notes}
            value={values.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            aria-invalid={Boolean(fieldErrors.notes)}
            aria-describedby={describedBy("notes")}
            className="text-base md:text-base"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="booking-consent"
              checked={values.consent}
              onCheckedChange={(checked) => updateField("consent", checked === true)}
              aria-invalid={Boolean(fieldErrors.consent)}
              aria-describedby={describedBy("consent")}
              aria-required="true"
              className="mt-0.5 size-5"
            />
            <Label htmlFor="booking-consent" className="block text-base leading-snug font-normal">
              Съгласен/на съм личните ми данни да бъдат обработвани за целите на записването за
              профилактичен преглед съгласно{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                политиката за поверителност
              </Link>
              .<RequiredMark />
            </Label>
          </div>
          <FieldError field="consent" error={fieldErrors.consent} />
        </div>

        </fieldset>

        <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />

        <div
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className={formMessage ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-base text-destructive outline-none" : "sr-only"}
        >
          {formMessage}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={locked}
          aria-disabled={locked}
          className="h-12 w-full text-base sm:w-auto sm:px-8"
        >
          {isPending ? "Записване…" : "Запази час"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Полетата, отбелязани със <span aria-hidden="true">*</span>
          <span className="sr-only">звездичка</span>, са задължителни.
        </p>
      </form>
    </div>
  );
}

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-destructive">
        {" "}*
      </span>
      <span className="sr-only"> (задължително)</span>
    </>
  );
}

function Field({
  label,
  field,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  field: BookingField;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`booking-${field}`} className="text-base">
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
      {hint ? (
        <p id={`booking-${field}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError field={field} error={error} />
    </div>
  );
}

function FieldError({ field, error }: { field: BookingField; error?: string }) {
  if (!error) return null;
  return (
    <p id={`booking-${field}-error`} className="text-sm text-destructive">
      {error}
    </p>
  );
}
