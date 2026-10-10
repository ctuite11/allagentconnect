# Fix Open House / Broker Tour display in Search cards

This only changes how events are shown. Saved events, scheduling, listing status, publishing, Hot Sheets and emails stay as they are.

## 1. Photo cards (Map and Grid): event banner goes under the status
- The status banner (Coming Soon, Off Market, On MLS, and so on) stays at the top-left.
- Each upcoming Open House or Broker Tour gets its own line underneath it, earliest first, with the full text, for example `BROKER TOUR: Oct 15 · 11:30 AM–1:30 PM`.
- The event line can be as wide as the photo, so the date and time aren't cut off. The text stays the same size and the cards stay the same size.
- The photo arrows stay clear. Banners sit at the top-left; the arrows are at the middle of each side.
- The selection checkbox still sits next to the status banner.

## 2. List View: correct event label
- The line currently reads "Open House: Oct 15 • …" even for Broker Tours.
- It will read **Broker Tour** for broker tours and **Open House** for public open houses. The date and time format stays the same.

## Where this applies
- The shared photo banners, so every card that uses them is consistent.
- The search card's List View line.

## Technical details
- `useListingBanners`: also return `openHouseBanners[]` (all upcoming events in date order, same shape as now). Keep `openHouseBanner` (the next event) for existing callers.
- `ListingPhotoBanners`: change the layout to a column. Row 1 has the checkbox (if any) and the primary banner. Each event badge goes on its own row below. Full label: `BROKER TOUR:` / `OPEN HOUSE:` + `MMM d · h:mm AM–h:mm PM`. The existing `compact` short label stays for tiny thumbnails. Accept an optional `openHouseBanners` prop and fall back to the single banner.
- `SearchListingCard`: pass `openHouseBanners`. The List View line (around line 487) uses `event_type === "broker_tour"` to choose the label.
- QA: in the preview, check Map, Grid and List views for a listing with a Broker Tour and a listing with an Open House. View only, no saving.
