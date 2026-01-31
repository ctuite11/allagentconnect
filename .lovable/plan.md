
# Display Scheduled Open Houses on Listing Cards

## Overview
Add inline display of scheduled open houses and broker tours in the **center content column** of each listing card, with individual edit options per event. Uses the blue car icon (already exists in the file) for broker tours.

## Layout (Based on Screenshot)

The events will appear in the center column, below the price/Quick Edit row:

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ Edit • Photos • 🎈 Open House • [🚙] Broker Tour • Matches • Email • Social    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                           ┌─────────────────┐  │
│ [Photo]  │ #L-1121                                        │ Coming Soon     │  │
│          │ 28-32 Atlantic Ave #436, Boston                │ List: 1/24/2026 │  │
│          │ MA 02110 · Waterfront                          │ Exp: 2/26/2026  │  │
│          │ $4,270,000  Quick Edit                         │ DOM: 6          │  │
│          │                                                └─────────────────┘  │
│          │ 🎈 Sat, Feb 1 · 1:00 PM - 3:00 PM         Edit                      │
│          │ [🚙] Tue, Feb 4 · 10:00 AM - 11:30 AM     Edit                      │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Each event** = icon + date/time + individual "Edit" button
- **Blue car icon** used for broker tours (already exists in codebase as `BlueCarIcon`)
- **Centered** in the middle column, not below Quick Edit in a way that expands the card height unnecessarily

---

## Technical Details

### File: `src/pages/MyListings.tsx`

**1. Add helper function to format open house display (near line 98):**
```typescript
function formatOpenHouseEvent(openHouse: any): { isBrokerTour: boolean; dateLabel: string; timeLabel: string } {
  const date = new Date(openHouse.date);
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  
  // Format times from 24h to 12h
  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };
  
  return {
    isBrokerTour: openHouse.event_type === "broker_tour",
    dateLabel: `${dayName}, ${monthDay}`,
    timeLabel: `${formatTime(openHouse.start_time)} - ${formatTime(openHouse.end_time)}`
  };
}
```

**2. Add scheduled events in the center column (after price section, ~line 735):**
```tsx
{/* Scheduled Open Houses / Broker Tours */}
{hasOpenHouses && (
  <div className="mt-2 space-y-1">
    {(l.open_houses as any[]).map((oh, idx) => {
      const event = formatOpenHouseEvent(oh);
      return (
        <div key={idx} className="flex items-center gap-2 text-xs text-zinc-600">
          {event.isBrokerTour ? (
            <BlueCarIcon className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <span className="shrink-0">🎈</span>
          )}
          <span>{event.dateLabel} · {event.timeLabel}</span>
          <button
            className="text-primary hover:text-primary/80 hover:underline ml-1"
            onClick={() => onViewOpenHouses(l)}
          >
            Edit
          </button>
        </div>
      );
    })}
  </div>
)}
```

---

## Icon Reference
The blue car icon already exists in the file (lines 14-23):
```tsx
function BlueCarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#0E56F5" d="..." />
    </svg>
  );
}
```

This will be reused for the inline broker tour display (no new icons needed).

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/MyListings.tsx` | Add helper function + inline event display in list view center column |

---

## Result
- Each scheduled event appears on its own line with icon + date/time
- Individual "Edit" link per event opens the existing ViewOpenHousesDialog
- Blue car icon (AAC Blue #0E56F5) for broker tours, 🎈 balloon for open houses
- Compact display that doesn't expand the card height significantly
