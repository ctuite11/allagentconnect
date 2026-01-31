
# Simplify Time Picker to Single Dropdown (MLS Style)

## Problem
The current time picker uses 3 separate dropdowns (Hour, Minute, AM/PM) which requires 3 clicks to select a time. The MLS-style picker uses a single dropdown with pre-formatted time slots, making selection much faster.

## Current vs Target

| Current | Target (MLS Style) |
|---------|-------------------|
| 3 dropdowns: Hr / Min / AM-PM | 1 dropdown: "12:00 AM", "12:15 AM", etc. |
| 3 clicks required | 1 click required |
| 70px + 70px + 70px wide | Single ~130px dropdown |

## Solution

Replace the `TimePicker12h` component internals with a single Select dropdown that displays all time options in 15-minute increments.

---

## Technical Details

### File: `src/components/ui/time-picker-12h.tsx`

**Changes:**
- Generate 96 time slots (24 hours × 4 intervals per hour)
- Display each as "12:00 AM", "12:15 AM", ... "11:45 PM"
- Store value internally as 24-hour format (unchanged API)
- Single Select component instead of three

**Time generation logic:**
```typescript
const timeSlots = [];
for (let h = 0; h < 24; h++) {
  for (const m of ["00", "15", "30", "45"]) {
    const hour24 = `${h.toString().padStart(2, "0")}:${m}`;
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const period = h < 12 ? "AM" : "PM";
    const label = `${displayHour}:${m} ${period}`;
    timeSlots.push({ value: hour24, label });
  }
}
// Result: [{value: "00:00", label: "12:00 AM"}, {value: "00:15", label: "12:15 AM"}, ...]
```

**Component structure:**
```tsx
<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="w-[130px]">
    <SelectValue placeholder="Select time" />
  </SelectTrigger>
  <SelectContent>
    {timeSlots.map((slot) => (
      <SelectItem key={slot.value} value={slot.value}>
        {slot.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Impact

- **No API changes** - Still accepts/returns 24-hour format strings
- **No consumer changes** - `OpenHouseDialog` works without modification
- **Faster UX** - Single click instead of three
- **Matches MLS pattern** - Familiar to agents

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/ui/time-picker-12h.tsx` | Rewrite to single dropdown |
