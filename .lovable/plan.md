## Findings
- The rental result itself is now loading: `/client/search?lt=for_rent` returns **1 result** for `300 Commercial St #434`.
- The map area is failing with Google’s message: **“This page didn’t load Google Maps correctly.”**
- Database confirms the current visible rental has coordinates, `listing_type = for_rent`, `status = coming_soon`, and `property_type = condo`, so the remaining issue is map rendering/API configuration, not the rental filter.

## Plan
1. **Keep the rental filter fix as-is**
   - Do not re-add `residential_rental`.
   - Do not change sale search behavior.

2. **Audit the map failure path**
   - Inspect `PropertyMap` for how it resolves the Google Maps API key and map ID.
   - Confirm whether the failure is caused by a missing/invalid/restricted key, missing map ID, or Advanced Marker setup.

3. **Make the buyer map degrade safely**
   - If Google Maps cannot initialize, show the rental list normally and replace the broken Google error surface with a clean non-blocking fallback.
   - Keep the map/pin behavior unchanged when the Maps key works.

4. **Verify both buyer routes**
   - `/client/search?lt=for_rent` for authenticated buyer search.
   - `/browse?lt=for_rent` for public/non-buyer browse.

## Technical notes
- No database migration is planned.
- No RLS changes are planned because the public listing policy already allows the coming-soon rental to be read.
- No changes to listing status banners, sale filters, agent listing flows, or reminders.