// Minimal RFC 5545 calendar file for a single appointment.
// Shared by the confirmation page and the confirmation email.

export type CalendarEvent = {
  uid: string;
  start: Date;
  durationMin: number;
  summary: string;
  location?: string | null;
  description?: string | null;
  /** CANCEL marks the event as cancelled (same uid, higher sequence). */
  method?: "PUBLISH" | "CANCEL";
};

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 octets must be folded (CRLF + space). Cyrillic
// characters take 2 bytes in UTF-8, so fold by bytes without splitting a
// character.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const cancelled = event.method === "CANCEL";
  const end = new Date(event.start.getTime() + event.durationMin * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//profilaktika-booking//BG",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${cancelled ? 1 : 0}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
