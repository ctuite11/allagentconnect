/** AAC market time begins at first publication, not when a Draft was saved. */
export type MarketDateListing = { status?: string | null; list_date?: string | null; active_date?: string | null };

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});
function dayInNewYork(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = nyFormatter.formatToParts(date);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  const y = value("year"), m = value("month"), d = value("day");
  return y && m && d ? `${y}-${m}-${d}` : null;
}
export function listingMarketDate(listing: MarketDateListing): string | null {
  if (listing.status?.toLowerCase() === "draft") return null;
  const date = listing.list_date || listing.active_date;
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return dayInNewYork(new Date(date));
}
/** Calendar-day DOM in Eastern time; publication day is day zero. */
export function listingDaysOnMarket(listing: MarketDateListing, today = new Date()): number | null {
  const date = listingMarketDate(listing);
  const now = dayInNewYork(today);
  if (!date || !now) return null;
  const utcDay = (s: string) => {
    const [y,m,d] = s.split("-").map(Number);
    return Date.UTC(y,m-1,d);
  };
  return Math.max(0, Math.floor((utcDay(now) - utcDay(date)) / 86400000));
}
export function formatListingMarketDate(listing: MarketDateListing): string | null {
  const date = listingMarketDate(listing);
  if (!date) return null;
  const [y,m,d] = date.split("-");
  return `${m}/${d}/${y}`;
}
