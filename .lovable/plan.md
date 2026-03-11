

## Remove Property Cards from Network Intelligence Section

Remove the property cards row (with photo placeholders) from `NetworkIntelligenceSection.tsx`. The dashboard mockup stays.

### Changes

**`src/components/home/NetworkIntelligenceSection.tsx`**
- Delete the `propertyCards` data array (lines 19-25)
- Delete the Property Cards Row JSX block (lines 115-135)
- Keep everything else (header, dashboard mockup with stats/chart/table)

