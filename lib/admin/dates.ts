// Calendar-date helpers for the slot generator. Dates are plain "YYYY-MM-DD"
// strings (no time zone); conversion to UTC happens in Postgres.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_GENERATOR_DAYS = 366;

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: { value: IsoWeekday; short: string; long: string }[] = [
  { value: 1, short: "Пн", long: "понеделник" },
  { value: 2, short: "Вт", long: "вторник" },
  { value: 3, short: "Ср", long: "сряда" },
  { value: 4, short: "Чт", long: "четвъртък" },
  { value: 5, short: "Пт", long: "петък" },
  { value: 6, short: "Сб", long: "събота" },
  { value: 7, short: "Нд", long: "неделя" },
];

function parse(date: string): Date | null {
  if (!DATE_PATTERN.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-30 and similar.
  return value.getUTCFullYear() === y && value.getUTCMonth() === m - 1 && value.getUTCDate() === d
    ? value
    : null;
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Dates from `from` to `to` (inclusive) that fall on one of `weekdays`.
 * Returns null for invalid input or ranges longer than MAX_GENERATOR_DAYS.
 */
export function datesInRange(from: string, to: string, weekdays: IsoWeekday[]): string[] | null {
  const start = parse(from);
  const end = parse(to);
  if (!start || !end || end < start) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_GENERATOR_DAYS) return null;

  const allowed = new Set(weekdays);
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 86_400_000);
    const iso = (((day.getUTCDay() + 6) % 7) + 1) as IsoWeekday;
    if (allowed.has(iso)) result.push(format(day));
  }
  return result;
}

/** "2026-10-15" -> "15.10.2026" */
export function formatIsoDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** "2026-10-15" -> ISO weekday of that calendar date. */
export function isoWeekdayOf(date: string): IsoWeekday | null {
  const value = parse(date);
  return value ? ((((value.getUTCDay() + 6) % 7) + 1) as IsoWeekday) : null;
}
