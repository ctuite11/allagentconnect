

# Move Scheduled Events to Far Right Column + Add Edit/Delete Options

## Overview
1. Move the scheduled events display from below Quick Edit to the **far right column** (under the status/dates section)
2. Replace single "Edit" button with **two options**: Edit and Delete for each event

---

## Layout

```text
                                        ┌─────────────────┐
                                        │ Coming Soon     │
                                        │ List: 1/24/2026 │
                                        │ Exp: 2/26/2026  │
                                        │ DOM: 6          │
                                        │─────────────────│
                                        │ 🎈 Sat, Feb 1   │
                                        │ 1:00-3:00 PM    │
                                        │ Edit • Delete   │
                                        │                 │
                                        │ 🚗 Tue, Feb 4   │
                                        │ 10:00-11:30 AM  │
                                        │ Edit • Delete   │
                                        └─────────────────┘
```

---

## Technical Details

### File: `src/pages/MyListings.tsx`

**1. Remove current placement (lines 757-784)**
Delete the scheduled events block from below Quick Edit.

**2. Add to far right column (after line 667)**
Add scheduled events under the DOM line in the absolutely positioned right container:

```tsx
{/* Scheduled Events */}
{hasOpenHouses && (
  <div className="mt-2 pt-2 border-t border-zinc-200 space-y-2">
    {(l.open_houses as any[]).map((oh, idx) => {
      const event = formatOpenHouseEvent(oh);
      return (
        <div key={idx} className="text-xs">
          <div className="flex items-center justify-end gap-1.5 text-zinc-600">
            {event.isBrokerTour ? (
              <BlueCarIcon className="h-3 w-3 shrink-0" />
            ) : (
              <span className="shrink-0">🎈</span>
            )}
            <span>{event.dateLabel}</span>
          </div>
          <div className="text-zinc-500">{event.timeLabel}</div>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            <button
              className="text-primary hover:underline"
              onClick={() => onViewOpenHouses(l)}
            >
              Edit
            </button>
            <span className="text-zinc-300">•</span>
            <button
              className="text-destructive hover:underline"
              onClick={() => handleDeleteOpenHouse(l.id, idx)}
            >
              Delete
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

**3. Add delete handler function**
```typescript
const handleDeleteOpenHouse = async (listingId: string, eventIndex: number) => {
  if (!confirm("Delete this scheduled event?")) return;
  
  const listing = listings.find(l => l.id === listingId);
  if (!listing) return;
  
  const updatedOpenHouses = (listing.open_houses as any[]).filter((_, i) => i !== eventIndex);
  
  const { error } = await supabase
    .from("listings")
    .update({ open_houses: updatedOpenHouses })
    .eq("id", listingId);
    
  if (error) {
    toast.error("Failed to delete event");
    return;
  }
  
  toast.success("Event deleted");
  refetch();
};
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/MyListings.tsx` | Move events to right column, add Edit + Delete per event |

---

## Result
- Scheduled events appear in the far right column under status/dates
- Each event shows icon, date, time range
- Individual "Edit" and "Delete" links for each event
- Card height remains compact
- Delete confirms before removing

