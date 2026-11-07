import { describe, expect, it } from "vitest";
import { listingDaysOnMarket, listingMarketDate, formatListingMarketDate } from "./listingDaysOnMarket";
describe("AAC publication-day DOM", () => {
  const draft = { status:"draft", list_date:"2026-10-28", created_at:"2026-10-28T16:37:25Z" };
  const published = { status:"off_market", list_date:"2026-11-06", created_at:"2026-10-28T16:37:25Z" };
  it("never counts Draft days", () => {
    expect(listingMarketDate(draft)).toBeNull();
    expect(listingDaysOnMarket(draft, new Date("2026-11-07T01:36:07Z"))).toBeNull();
  });
  it("starts at zero at first publication, not Draft creation", () => {
    expect(listingDaysOnMarket(published, new Date("2026-11-07T01:36:07Z"))).toBe(0);
    expect(listingDaysOnMarket(published, new Date("2026-11-07T16:00:00Z"))).toBe(1);
    expect(formatListingMarketDate(published)).toBe("11/06/2026");
  });
  it("does not invent a market date from created_at", () => {
    expect(listingDaysOnMarket({status:"off_market"}, new Date())).toBeNull();
  });
  it("supports legacy active_date timestamps in Eastern time", () => {
    expect(listingDaysOnMarket({status:"active",active_date:"2026-11-07T01:36:07Z"}, new Date("2026-11-07T03:00:00Z"))).toBe(0);
  });
});
