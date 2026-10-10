# Live QA: Open House / Broker Tour date fix

Netlify published `main@9334245` at 9:10 PM, and that version includes the date fix, so the fix is now live on allagentconnect.com.

## Steps
1. Confirm the live site is running the new version.
2. On a test listing I own, add:
   - Broker Tour: Oct 15, 2026, 11:30 AM–1:30 PM
   - Public Open House: Oct 15, 2026, 11:30 AM–1:30 PM
3. Check that both show **Thu, Oct 15** in each of these places:
   - The Scheduled Open Houses & Broker Tours popup
   - The open house dates on My Listings
   - The banners on listing photos
   - Search result cards
   - The two other listing card screens
4. Check that both saved dates are still exactly `2026-10-15`.
5. Remove the two test events so the listing goes back to how it was.
6. Report the results and stop.

## Limits
- No code changes and no other data changes.
- Nothing gets published, and no Hot Sheet emails or other emails are sent. The test listing stays at its current status. If it's live and adding events could alert buyers, I'll stop and ask first.
