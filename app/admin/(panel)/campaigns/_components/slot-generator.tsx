"use client";

import { X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  datesInRange,
  formatIsoDate,
  isoWeekdayOf,
  WEEKDAYS,
  type IsoWeekday,
} from "@/lib/admin/dates";
import { dateKey, formatTime } from "@/lib/datetime";

import { generateSlotsAction, type GeneratedSlot } from "../actions";

type Props = { campaignId: string; today: string };

type Errors = Record<string, string>;

export function SlotGenerator({ campaignId, today }: Props) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [weekdays, setWeekdays] = useState<IsoWeekday[]>([1, 2, 3, 4, 5]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [duration, setDuration] = useState("30");
  const [capacity, setCapacity] = useState("1");
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const allDates = useMemo(() => datesInRange(from, to, weekdays), [from, to, weekdays]);
  const dates = useMemo(
    () => (allDates ?? []).filter((d) => !excluded.includes(d)),
    [allDates, excluded],
  );

  // Any change invalidates the preview.
  function changed<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPreview(null);
      setMessage(null);
    };
  }

  function input() {
    return { campaignId, dates, start, end, durationMin: duration, capacity };
  }

  function runPreview() {
    setMessage(null);
    setErrors({});
    if (allDates === null) {
      setErrors({ dates: "Невалиден период (най-много 366 дни, „до“ след „от“)." });
      return;
    }
    startTransition(async () => {
      const result = await generateSlotsAction(input(), true);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setPreview(result.data);
    });
  }

  function create() {
    startTransition(async () => {
      const result = await generateSlotsAction(input(), false);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      const created = result.data.filter((s) => s.status === "new").length;
      const skipped = result.data.length - created;
      setPreview(null);
      setMessage({
        kind: "ok",
        text: `Създадени часове: ${created}.${skipped ? ` Пропуснати (вече съществуват или са минали): ${skipped}.` : ""}`,
      });
    });
  }

  const counts = preview
    ? {
        new: preview.filter((s) => s.status === "new").length,
        exists: preview.filter((s) => s.status === "exists").length,
        past: preview.filter((s) => s.status === "past").length,
      }
    : null;

  const previewByDay = useMemo(() => {
    const map = new Map<string, GeneratedSlot[]>();
    for (const slot of preview ?? []) {
      const key = dateKey(new Date(slot.startsAt));
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()];
  }, [preview]);

  const err = (key: string) =>
    errors[key] ? (
      <p id={`gen-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <section aria-labelledby="generator-heading" className="flex flex-col gap-5 rounded-xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 id="generator-heading" className="text-lg font-semibold">
          Генератор на часове
        </h2>
        <p className="text-sm text-muted-foreground">
          Почивка (напр. обедна): генерирайте два пъти за същия период, напр. 09:00–12:00 и
          13:00–16:00. Съществуващите часове се прескачат.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-from">От дата</Label>
          <Input id="gen-from" type="date" value={from} min={today} onChange={(e) => changed(setFrom)(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-to">До дата</Label>
          <Input id="gen-to" type="date" value={to} min={from} onChange={(e) => changed(setTo)(e.target.value)} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Дни от седмицата</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const checked = weekdays.includes(day.value);
            return (
              <label
                key={day.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    changed(setWeekdays)(
                      checked ? weekdays.filter((w) => w !== day.value) : [...weekdays, day.value].sort(),
                    )
                  }
                />
                <span aria-hidden="true">{day.short}</span>
                <span className="sr-only">{day.long}</span>
              </label>
            );
          })}
        </div>
        {err("dates")}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Дати ({dates.length})
          {excluded.length ? (
            <button
              type="button"
              className="ml-2 text-sm font-normal underline underline-offset-4"
              onClick={() => changed(setExcluded)([])}
            >
              върни махнатите ({excluded.length})
            </button>
          ) : null}
        </p>
        {allDates === null ? (
          <p className="text-sm text-destructive">Невалиден период (най-много 366 дни, „до“ след „от“).</p>
        ) : dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Няма дати за избраните дни.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Избрани дати">
            {dates.map((d) => (
              <li key={d}>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-sm tabular-nums">
                  {WEEKDAYS.find((w) => w.value === isoWeekdayOf(d))?.short} {formatIsoDate(d)}
                  <button
                    type="button"
                    onClick={() => changed(setExcluded)([...excluded, d])}
                    aria-label={`Махни ${formatIsoDate(d)}`}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-start">Начален час</Label>
          <Input id="gen-start" type="time" step={300} value={start} onChange={(e) => changed(setStart)(e.target.value)} aria-describedby={errors.start ? "gen-start-error" : undefined} />
          {err("start")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-end">Краен час</Label>
          <Input id="gen-end" type="time" step={300} value={end} onChange={(e) => changed(setEnd)(e.target.value)} aria-describedby={errors.end ? "gen-end-error" : undefined} />
          {err("end")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-duration">Продължителност (мин)</Label>
          <Input id="gen-duration" type="number" min={5} max={480} step={5} inputMode="numeric" value={duration} onChange={(e) => changed(setDuration)(e.target.value)} aria-describedby={errors.durationMin ? "gen-durationMin-error" : undefined} />
          {err("durationMin")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-capacity">Места в час</Label>
          <Input id="gen-capacity" type="number" min={1} max={100} inputMode="numeric" value={capacity} onChange={(e) => changed(setCapacity)(e.target.value)} aria-describedby={errors.capacity ? "gen-capacity-error" : undefined} />
          {err("capacity")}
        </div>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">Последният час свършва до крайния час.</p>

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

      {preview && counts ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
          <p className="text-sm" role="status">
            Нови: <strong>{counts.new}</strong>
            {counts.exists ? <> · Вече съществуват: <strong>{counts.exists}</strong></> : null}
            {counts.past ? <> · Минали: <strong>{counts.past}</strong></> : null}
          </p>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {previewByDay.map(([day, slots]) => (
              <div key={day} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="w-24 shrink-0 font-medium tabular-nums">{formatIsoDate(day)}</span>
                {slots.map((s) => (
                  <span
                    key={s.startsAt}
                    className={s.status === "new" ? "tabular-nums" : "tabular-nums text-muted-foreground line-through"}
                    title={s.status === "exists" ? "Вече съществува" : s.status === "past" ? "Минал" : undefined}
                  >
                    {formatTime(new Date(s.startsAt))}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={runPreview} disabled={isPending || dates.length === 0}>
          Преглед
        </Button>
        <Button type="button" onClick={create} disabled={isPending || !counts || counts.new === 0}>
          {counts ? `Създай ${counts.new} часа` : "Създай"}
        </Button>
      </div>
    </section>
  );
}
