

# Auto-Remove Past Open Houses and Broker Tours

## The Problem

When an open house or broker tour's date and time passes, the event data stays in the system forever. It still shows on your My Listings cards, in the View Open Houses dialog, and clutters the database.

## What Gets Built

### 1. Automatic Cleanup (Backend -- runs every 15 minutes)

Add a new section (Part 3) to the existing `update-listing-statuses` backend function that already runs on a 15-minute schedule. It will:

- Query all listings that have an `open_houses` array
- For each listing, check every event's date + end_time against the current time
- Remove any event where the end time has already passed
- Update the listing with only the future events remaining
- If all events have passed, set `open_houses` to an empty array

This means past events are automatically cleaned up within 15 minutes of ending -- no manual work needed.

### 2. Frontend Safety Net (Immediate filtering)

Even though the backend cleans up every 15 minutes, there could be a brief window where a past event still shows. To handle that:

- **My Listings page**: Filter out past events before displaying the inline open house/broker tour lines, so agents never see stale events
- **View Open Houses dialog**: Filter out past events from the list, so only upcoming events appear

The search results pages already do this filtering, so no changes needed there.

## Files Changed

| File | What Changes |
|------|-------------|
| `supabase/functions/update-listing-statuses/index.ts` | Add Part 3: auto-remove past open house/broker tour events from the `open_houses` array |
| `src/pages/MyListings.tsx` | Filter out past events before rendering inline event lines |
| `src/components/ViewOpenHousesDialog.tsx` | Filter out past events from the displayed list |

## What Does NOT Change

- How open houses are created (OpenHouseDialog stays the same)
- Search result filtering (already works correctly)
- Listing statuses or expiration logic
- No new database tables or migrations needed

## Technical Details

The cleanup logic in the backend function:

```text
For each listing with open_houses:
  Filter events where: new Date(`${event.date}T${event.end_time}`) > now
  If filtered array differs from original:
    Update listing with filtered array
    Log: "Removed X past event(s) from listing Y"
```

The frontend filter (applied in both MyListings and ViewOpenHousesDialog):

```text
const now = new Date();
const upcomingEvents = events.filter(e => 
  new Date(`${e.date}T${e.end_time}`) > now
);
```
