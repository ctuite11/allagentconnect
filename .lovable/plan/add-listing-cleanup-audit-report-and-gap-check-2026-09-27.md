# Add Listing cleanup: audit report and gap check

Most of this request was built in the previous step: the review before publishing, the bottom buttons, the DCMLS highlight and the new agreement option. This plan does not rebuild any of it. It writes up the audit you asked for, checks the finished work against each item, and fixes only what is missing.

## Step 1: Audit report (read-only, sent to you before any change)
Each item gets one label: previously live and now broken, built in a draft but never merged, or never built. Each label is backed by project history.
1. Review before publishing
2. Preview (what was found, where, and whether it was reconnected)
3. DCMLS highlight
4. "Opt in to DCMLS" button: this item has not been checked yet
5. Listing agreement option
6. Bottom Save Draft | Preview | Publish Listing row
7. Social sharing: confirm it is still only in the draft (not a regression)

## Step 2: Check the finished work against your spec
- Review before publishing: shows the cover photo, address, property type, beds, baths and sq ft. The buttons are Go Back / Edit and Yes, Publish Listing. The fully-uploaded-photo check still runs.
- Preview opens a real preview, not "coming soon".
- The DCMLS block is tinted and has a border and a left accent bar. The publishing rules have not changed.
- "Exclusive Right to Sell — Buyer-Broker Compensation Offered" is in the list. Nothing says "Variable Rate", and saved choices still load.
- The bottom row uses the same actions as the top buttons. The top bar hides while the bottom row is on screen.

## Step 3: "Opt in to DCMLS" button (new)
- If the agent is not in DCMLS, the DCMLS section on Add Listing and Edit Listing shows "Opt in to DCMLS".
- After a successful opt-in, the "Show this listing on DCMLS" checkbox turns on. The listing is not published.
- Agents who are already in DCMLS do not see the button.
- If this was built before (live or in a draft), I will bring that version back. If it was never built, I will report that and stop instead of creating it. The DCMLS participation rules stay the same.

## Out of scope
Hot Sheets, email matching and delivery, DCMLS participation and publishing rules, listing statuses, the first-publish photo rule, and the social media screens.

## Technical
- History search: git log -S / -G on AddListing.tsx, DcmlsPublishControl.tsx, the preview handler, the publish dialog, and anything matching "opt in"/"dcmls_participat".
- Visual checks need an agent-role session; the admin test account cannot open /agent Add Listing. The report will name any checks you need to do with your own agent login.
