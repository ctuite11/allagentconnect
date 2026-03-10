

# Fix: Photo inset inside card + round-top red pin

## What went wrong
The photo is currently flush to the card edge (no padding, no rounded corners on the photo itself). Your screenshot shows it should be **inset** — with padding around it and rounded corners, sitting inside the card boundary.

The pin icon is also still wrong. Lucide `Pin` is a thumbtack (pointed top). You want a **round-top** map pin — that is `MapPin` with `fill="currentColor"`.

## Changes — `SearchListingCard.tsx`

### 1. Photo inset (desktop, line 240)
Add padding to the photo container and rounded corners to the image:
```
Before: <div className="relative flex-shrink-0 w-52 h-auto min-h-[9rem]">
After:  <div className="relative flex-shrink-0 w-52 p-3">
```
And the `<img>` gets `rounded-lg`:
```
Before: <img ... className="h-full w-full object-cover" />
After:  <img ... className="h-full w-full object-cover rounded-lg" />
```
Same for the placeholder div — add `rounded-lg`.

Photo count badge repositioned to account for padding: `bottom-4 left-4`.

### 2. Pin icon (line 296)
Replace `Pin` with `MapPin` + `fill="currentColor"` for the solid round-top pin:
```tsx
<MapPin className="w-3 h-3 mr-1 text-red-400" fill="currentColor" />
```

### 3. Remove unused `Pin` from imports (line 19)

Only these three changes. Nothing else touched.

