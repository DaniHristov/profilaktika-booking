import { z } from "zod";

// Filters of the admin bookings table, read from the URL. Shared with the
// export so it exports exactly what the table shows.

export const BOOKINGS_PAGE_SIZE = 50;

export type BookingStatusFilter = "confirmed" | "cancelled" | "all";

export type BookingFilters = {
  campaignId: string | null;
  date: string | null; // YYYY-MM-DD, Europe/Sofia
  time: string | null; // HH:MM, Europe/Sofia
  status: BookingStatusFilter;
  q: string | null;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const schema = z.object({
  campaign: z.uuid().optional().catch(undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().catch(undefined),
  status: z.enum(["confirmed", "cancelled", "all"]).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

/** Invalid values fall back to defaults instead of failing the page. */
export function parseBookingFilters(params: RawParams): BookingFilters {
  const parsed = schema.parse({
    campaign: first(params.campaign) || undefined,
    date: first(params.date) || undefined,
    time: first(params.time) || undefined,
    status: first(params.status) || undefined,
    q: first(params.q) || undefined,
    page: first(params.page) || undefined,
  });
  return {
    campaignId: parsed.campaign ?? null,
    date: parsed.date ?? null,
    time: parsed.time ?? null,
    status: parsed.status ?? "confirmed",
    q: parsed.q ? parsed.q : null,
    page: parsed.page ?? 1,
  };
}

/** Query string for links (page and export), omitting defaults. */
export function bookingFiltersToQuery(filters: BookingFilters, overrides: Partial<BookingFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.campaignId) params.set("campaign", f.campaignId);
  if (f.date) params.set("date", f.date);
  if (f.time) params.set("time", f.time);
  if (f.status !== "confirmed") params.set("status", f.status);
  if (f.q) params.set("q", f.q);
  if (f.page > 1) params.set("page", String(f.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
