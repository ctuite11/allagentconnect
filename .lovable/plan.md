

# Replace neighborhood icon with pushpin

Lucide provides a `Pin` icon that renders as a pushpin — matching the user's reference image. The `MapPin` (blue, for city/state) stays unchanged.

## Changes — `src/components/listing-search/SearchListingCard.tsx`

1. **Import**: Add `Pin` to the lucide-react import (line 17).
2. **Line 296**: Replace `<MapPin className="w-3 h-3 mr-1 text-red-400" />` with `<Pin className="w-3 h-3 mr-1 text-red-400" fill="currentColor" />` — solid red pushpin.
3. **Line 326**: Remove remaining `mt-0.5` → no class (zero gap between neighborhood and listing # row).

