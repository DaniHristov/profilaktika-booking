// All times are stored in UTC and shown in Europe/Sofia.
export const APP_TIME_ZONE = "Europe/Sofia";

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  const formatted = new Intl.DateTimeFormat("bg-BG", {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).formatToParts(date);
  return Object.fromEntries(formatted.map((p) => [p.type, p.value])) as Record<
    Intl.DateTimeFormatPartTypes,
    string
  >;
}

/** "15.10.2026" */
export function formatDate(date: Date): string {
  const p = parts(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}.${p.month}.${p.year}`;
}

/** "09:00" (24-hour) */
export function formatTime(date: Date): string {
  const p = parts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** "2026-10-15" in Sofia time; used to group slots by day. */
export function dateKey(date: Date): string {
  const p = parts(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "четвъртък" */
export function formatWeekday(date: Date): string {
  return parts(date, { weekday: "long" }).weekday;
}

/** "чт" */
export function formatWeekdayShort(date: Date): string {
  return parts(date, { weekday: "short" }).weekday;
}
