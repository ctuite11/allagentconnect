# Draft-publish protection: close out 16 N Mead St

16 N Mead St is still the open case. Nobody claims the system is fully protected until every step below passes.

## Current state (checked today)
- The server-side guard is turned on in the live database. It rejects any Draft → non-Draft change unless the audited `publish_listing()` function makes it. That function is called only from the final "Yes, Publish Listing" click.
- The code no longer has the old reusable "confirmed" flag. Add Listing now calls the publish function.
- I haven't confirmed yet that the frontend change for the guard is on allagentconnect.com. Step 1 checks that.
- The Manage Photos/Floor Plans changes (return flow, Back vs Save & Return) are held. They won't deploy until step 4 passes.

## Steps
1. **Check what's live.** Confirm the commit running on allagentconnect.com includes the Add Listing change to the publish function. Report the commit and whether the live bundle still contains any direct status-write path. Read-only.
2. **16 N Mead St investigation (read-only).** Line up every write on that listing around 17:58:44 UTC Oct 9 against the Add Listing code at the commit that was live then: request logs, autosave timing, and status history. Name the exact frontend path as far as the evidence supports it. Say clearly what is proven and what is inferred. Change no data.
3. **Guard sanity check.** Re-confirm the trigger covers every role and every update path, including inserts, admin, service role, and the dormant external sync. Read-only.
4. **Full disposable-Draft QA in preview.** Hot Sheet emails are paused for the whole test and turned back on only with your approval. Use one brand-new test Draft and run each action, confirming the status stays `draft` after each one:
   - Autosave, Save Draft, Save Changes, with the status dropdown set to Coming Soon
   - Manage Photos: Save & Return, and Back (both the warning and leave-without-saving)
   - Manage Floor Plans: Save & Return, and Back
   - Document add/remove/save, Preview, navigating away and back, Quick Edit price change
   - A direct status write attempt, which the database should reject
   - Then the real flow: Publish → "Ready to publish?" → Cancel stays Draft, and "Yes, Publish Listing" publishes once and is audited
   - Record queue and Hot Sheet counts before and after. The only allowed activity is from the test listing. Delete the test Draft afterwards.
5. **Report and stop.** You get a full pass/fail table. Production deploy of the held changes happens only after your approval.

## Out of scope
No emails, invites, Hot Sheet batch changes, template changes, or edits to real listings.
