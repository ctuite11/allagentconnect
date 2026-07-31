## Style the "Verified" lifecycle state in light AAC green

Match the treatment already used for the blue "New request" pill, but in AAC Success Emerald.

### What changes
In `src/pages/AdminApprovals.tsx` (and the matching badge in `src/components/admin/AgentDetailsDrawer.tsx` so the drawer agrees with the table):

- The **Verified** status badge in the Status column and the **Verified** lifecycle filter pill get:
  - light emerald background
  - emerald text
  - emerald border
  - same compact rounded-pill size/padding as the existing pills
- Uses the AAC Success token (`#059669` / emerald-600 family) from `src/lib/brandColors.ts` — light tint background, not a solid fill.

### What does not change
- Pending, Activated, and Rejected keep their current styling.
- No change to lifecycle derivation, counts, filters, timestamps, or data.

### Technical note
Styling only — badge/pill class strings. No edge function or database work.
