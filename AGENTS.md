# Project rules

- On-screen listing addresses use `buildDisplayAddress` / `listingCardStreetHeading` from `src/lib/utils`; web and email formatters share `supabase/functions/_shared/addressFormatFixtures.json` so the website and emails format addresses the same way.
- First-publish social selections live on Add Listing and persist as listing defaults; the publish confirmation stays listing-only and later update choices remain one-off, keeping publishing concerns separated.
