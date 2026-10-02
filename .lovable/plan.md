# Fix 4 monitoring findings

Each fix is independent. No email templates, Hot Sheet behavior, publish rules, or social launch gate change. No test emails, no listing publish, no unsubscribe rows written during QA.

## 1. Shared property pages broken for signed-out visitors (high)
**Confirmed:** `/property/:id` (PropertyDetail page) reads the listings table and agent profiles directly. Signed-out visitors were locked out of those tables in August, so the page fails. The consumer property page already handles this correctly.

**Fix:** When no one is signed in, load the listing and agent through the same safe public lookups the consumer page uses (`fetchPublicListing` / `fetchPublicListingAgent`). Signed-in users keep today's path unchanged. Database access stays the same.

**QA:** Open a published listing signed out → photos, details, agent contact show. Open the same listing signed in → unchanged.

## 2. Unsubscribe links show an error page (high)
**Confirmed:** The unsubscribe table exists, but it only accepts 4 categories (listing shares, hot sheet alerts, marketing, all). Emails now send unsubscribe links for 6 more categories (account reminders, Comms broadcast/digest, member updates, development notifications, listing broadcast), so those clicks fail to save and show the error page.

**Fix:** One database change that widens the allowed list to match exactly the categories the unsubscribe page accepts. Additive only, so existing rows stay valid. No email or template changes.

**QA:** Confirm the new rule is in place and that the list matches the unsubscribe page code. I won't click real links or write test unsubscribe rows.

## 3. Admin roster email-status columns time out (high)
**Partly confirmed:** The suggested cause, missing lookup indexes, is wrong. The indexes are already there (about 16k email records). The timeout happens when the whole roster is checked in one request. The exact slow step is **not confirmed yet**.

**Fix:**
1. Run a read-only timing check of the summary lookup for the full roster to find the slow step.
2. Planned fix: check recipients in batches (for example, 200 at a time) inside the admin function and combine the results. The output, columns, and meaning stay the same. If the timing check shows a different cause, I'll tell you before changing anything else.

**QA:** Load Admin → Agents → the Last Email / Invite / License Verified columns fill in with no error. This is read-only.

## 4. Publish popup shows a stuck "…" social section (medium)
**Confirmed:** When social connection status can't be loaded, the popup still shows the social section with four buttons stuck on "…". That happens for every normal agent while social publishing is test-only, and for admins when the check fails.

**Fix:** Show the social section only after connection status has loaded successfully at least once in this session. While it's loading on first open, keep today's fixed-size loading rows. If the check fails or the agent isn't allowed to use social publishing, hide the whole section. The "Ready to publish?" popup itself and "Yes, Publish Listing" stay unchanged for everyone. This matches the approved rule that normal agents never see social sharing.

**QA:** Use a disposable Draft and stop at Go Back. Social status is stubbed to fail → no social section, publish button works. Stubbed success → same one-button rows as today. Delete the Draft while it's still a Draft and confirm no side effects.

## Technical details
- `src/pages/PropertyDetail.tsx`: an anonymous branch in `fetchListing` uses `fetchPublicListing` / `fetchPublicListingAgent` from `src/lib/publicListing.ts`, mapped through `toPublicListingViewModel` / `toPublicAgentProfile` as in `ConsumerPropertyDetail.tsx`.
- Migration: drop the old category CHECK on `public.email_unsubscribes` and add a new one listing the 10 values in `VALID_CATEGORIES` (`supabase/functions/email-unsubscribe/index.ts`). The source CHECK stays as it is.
- `supabase/functions/admin-agent-email-summary/index.ts`: chunk `recipients` and call `admin_agent_email_summary` per chunk in sequence. The RPC stays unchanged. Redeploy only this function.
- `src/pages/AddListing.tsx` (~line 6395): pass `social` only when `publishSocialConnected` is non-null or `publishSocialStatus === "loading"` with no prior failure. On `"error"`/null, pass `null`.
