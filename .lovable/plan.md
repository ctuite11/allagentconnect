## Goal
Replace the 5 screenshot assets in the Early Access v2 email with the user's freshly uploaded screenshots, plus add the new Footer screenshot. Captions only — no template/layout edits.

## Image swaps
Copy uploads into `src/assets/email/early-access-v2/` (overwriting existing files), then upload to Supabase Storage `email-attachments/early-access-v2/` so the live email picks them up:

1. `01-home.png` ← Homepage screenshot (hero "See the market before it happens")
2. `02-success-hub.png` ← Success Hub screenshot (dark sidebar, Jessica Carter, Market activity)
3. `03-results.png` ← Search Results screenshot (Edit search, map + 5 listing cards)
4. `04-comms.png` ← Communications Center screenshot (Channels + My Preferences)
5. `05-network.png` ← AAC Referral Network screenshot (5 agent cards)
6. `06-footer.png` ← **NEW** Footer screenshot (dark footer with Platform / Solutions / Company columns)

## Edge function update
In `supabase/functions/send-bulk-email/index.ts`, extend `buildEarlyAccessUpdateV2Body()` to add a 6th section for the Footer with the image and a short caption. Keep the existing 5 sections' captions as they are. No changes to subject, layout, or template registration.

Caption draft for the new Footer section:
- **Title:** "One quiet front door"
- **Body:** "Everything ties back to a single private network — no public listings, no consumer noise. Just verified agents talking to verified agents."

## Deploy
Redeploy `send-bulk-email` so the new caption + image render on the next test send.

## Out of scope
- No edits to v1 template
- No changes to BulkEmailDialog / EmailAgentDialog (v2 option already exists)
- No edits to the screenshots themselves
