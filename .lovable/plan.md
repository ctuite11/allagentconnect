

# Parking Section Reorganization

## File
`src/pages/AddListing.tsx` (lines 4095-4223)

## Current Layout
1. Title "Parking"
2. Total Parking Spaces + Garage Spaces (side by side)
3. Parking Features checkboxes
4. Parking Comments
5. Garage Features checkboxes
6. Garage Additional Features checkboxes (EV Charger, Workshop, High Ceiling, Loft Storage)
7. Garage Comments

## New Layout
1. **Title "Parking"**
2. **# of Parking Spaces** (single numeric input)
3. **Parking Features** checkboxes (unchanged list)
4. **Parking Comments** textarea
5. **# of Garage Spaces** (single numeric input, moved below parking comments)
6. **Garage Features** checkboxes -- add "EV Charger" to this list (new list: Attached, Detached, Heated, Under, Oversized, Electric Door, Storage Above, EV Charger)
7. **Remove "Garage Additional Features"** section entirely
8. **Garage Comments** textarea
9. **Total Parking** (read-only or numeric field showing sum of parking + garage spaces)

## Technical Details

### UI changes (lines 4095-4223):
- Split the current 2-column numeric row into two separate single fields in their new positions
- Move "# of Parking Spaces" to top (rename from "Total Parking Spaces", reuse `total_parking_spaces` key but repurpose -- or add a new `parking_spaces` field)
- Move "# of Garage Spaces" below Parking Comments
- Add "EV Charger" to the garage features checkbox array
- Remove the entire "Garage Additional Features" block (lines 4187-4210)
- Add a "Total Parking" computed field at the bottom that sums parking + garage spaces

### State changes:
- Add `parking_spaces` to `formData` initial state (new field for non-garage parking count)
- Repurpose `total_parking_spaces` as the computed total display
- Remove `garageAdditionalFeatures` state usage (keep state var to avoid breaking hydration of old data, but remove UI)
- On save: compute `total_parking_spaces` = parking_spaces + garage_spaces

### Database:
- Add `parking_spaces` numeric column to `listings` table (migration needed)
- `total_parking_spaces` continues to store the combined total

### Save/hydration updates:
- Hydrate `parking_spaces` from DB
- On save, set `total_parking_spaces` = Number(parking_spaces) + Number(garage_spaces)
- Stop saving `garage_additional_features_list` for new listings (existing data preserved)

