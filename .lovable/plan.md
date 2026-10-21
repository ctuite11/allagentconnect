# Hot Sheet card Back button + draft email check

## 1. Back from a buyer Hot Sheet goes to Hot Sheets

**What happens now:** Clicking a buyer card with one Hot Sheet opens its results. The Back button there goes to the buyer's dashboard first whenever the sheet has a buyer, so you end up on the buyer page instead of Hot Sheets.

**Fix:**
- When you open results from a Hot Sheets card, remember that you came from Hot Sheets.
- On the results page, Back goes to Hot Sheets when that's where you came from.
- If you opened results from a buyer's dashboard, Back still goes to that buyer's dashboard.
- Buyer cards with several Hot Sheets work the same way: Hot Sheets → buyer list → results → Back → buyer list → Back → Hot Sheets.

## 2. Saved drafts never send email alerts

**What I checked (read-only):** You have 3 saved drafts ("new test", "test new", "another test"). None is active, and **no email has ever been queued for any of them**. Drafts are always kept inactive, and the new-match email only looks at active Hot Sheets. The Hot Sheet send and invitation steps already refuse drafts.

**Extra protection (no change in behavior):**
- The new-match alert email will also skip any sheet marked as a draft, so a draft can't send even if it somehow became active.
- Add a small test that fails if a draft could ever get a match alert.

If you did get an email you think came from a draft, tell me the Hot Sheet name and I'll trace it.

## Not changing
Email templates, active Hot Sheets, buyers, invitations, the email queue. No emails sent during testing.

## Technical details
- `HotSheets.tsx` `handleCardClick`: pass `state: { from: "/agent/hot-sheets" }` on the single-sheet review navigate.
- `HotSheetReview.tsx` `handleAgentHotSheetReviewBack`: if `originFrom` is `/agent/hot-sheets` or `/hot-sheets`, go to `AGENT_HOT_SHEETS_PATH` before the buyer-dashboard fallback; when opened from `HotSheetBuyerDetail`, pass `from` as the buyer-detail path (keeping its own `from`) so Back returns there.
- `send-new-match-notification`: add `.or("is_draft.is.null,is_draft.eq.false")` beside `.eq("is_active", true)`; deploy that one function.
- Test: extend `hotSheetRules.test.ts` (or a new test beside it) for the back-target rule and draft exclusion.
