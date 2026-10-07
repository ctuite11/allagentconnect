# Two fixes: Add Additional Contact + stale invitation eligibility

Scope is exactly these two items. Nothing will be sent. The two waiting batches (kerri, Buyer 1 Boston Condo's) stay untouched. The connected-state rule stays as it is.

## 1. Restore Add Additional Contact on Create Hot Sheet

**Cause (confirmed):** When Create Hot Sheet is opened from a buyer (the Buyer detail and Buyer Account pages), the form runs in "locked to buyer" mode. In that mode, both the "Add another" button and the contact search are hidden. The original "Add Additional Contact" link was removed in the Feb 16–18 contact-display rework.

**Fix (frontend only, `CreateHotSheetDialog.tsx`):**
- Show an **Add Additional Contact** button beneath the selected contact(s) in all modes, including locked-to-buyer.
- Clicking it opens the existing search/add-contact picker that is already in this form.
- The buyer the sheet was created from stays selected and keeps no Remove button (existing behavior). Added contacts can be removed.
- Saving already attaches every selected contact to the same Hot Sheet, so no save logic changes.
- No changes to matching, invitations, email, the review flow, or the layout beyond restoring this control.

## 2. Stale invitation fix (approved smallest fix)

**Cause (from the read-only trace):** The global invite-eligibility lookup counts any non-revoked Hot Sheet invite for the same email, including tokens for deleted contacts or deleted Hot Sheets. So `sendDashboardInvite` is false, and Send First Batch & Invite **skips** the invitation entirely.

**Fix:** Change only the global-token eligibility lookup in the two copies (`HotSheetReview.tsx` and `src/lib/enqueueHotSheetClientInvites.ts`). Load the agent's existing contact IDs and Hot Sheet IDs (read-only). Then drop any token whose `payload.client_id` or `payload.hot_sheet_id` no longer exists. Tokens tied to live contacts and live Hot Sheets still count, so "one dashboard invite per buyer" is kept.

No changes to: the connected-state logic, same-Hot-Sheet reminders, backend matching or batch delivery, templates, dedupe, or the waiting batches.

## Verification (no Send pressed)

1. Build passes.
2. Create Hot Sheet opened from a buyer shows Add Additional Contact. It opens the picker, and the primary buyer stays selected. The form is closed without saving.
3. Computed eligibility: kerri is eligible for a first invite, and so is Buyer 1 Boston Condo's. The genuinely connected buyer (sdfdsafdsa) is not eligible.
4. Confirm the specific May 16 stale token is excluded by the new filter (identify it by ID, and show that its contact or Hot Sheet is missing).
5. `email_jobs` count stays at 16,528. `share_tokens` is unchanged (same count and same latest row).
6. Report the exact code changes and results, then stop. A real invitation test needs separate approval.
