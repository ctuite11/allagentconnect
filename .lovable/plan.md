# Admin-only "test listing" mark (proposal)

## Answer to your question
Not safely today. The only hide setting keeps a listing out of Success Hub Listing Activity. A published listing still shows up in search and can send Hot Sheet emails.

## Proposal
Add an admin-only **Test listing** mark. A listing with this mark can go through the real publish flow while:
- staying out of search results, public listing pages, share links and Listing Activity
- never creating Hot Sheet events or emails, or any listing emails
- never going to DCMLS
- never posting to social media (the social step is skipped)
- being visible only to its owner and admins, with a "Test listing" badge

After a test, the listing is deleted.

## Order of work
1. Read-only check of every place that reads live listings (search, public pages, Hot Sheet triggers, email and DCMLS functions) to list exactly what needs the filter.
2. Database change adding the mark (default off, so real listings are unaffected). The Hot Sheet trigger and email functions skip marked listings. Search and public views exclude them.
3. Admin-only switch to set the mark on a Draft before publishing.
4. Controlled test: one marked fake Draft is published. Confirm zero Hot Sheet or email records, no search result, no DCMLS, no social. Then delete it.

This needs your approval of the database change and of the one controlled publish.
