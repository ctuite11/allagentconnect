To: Nenad (Weborik)
Cc: Chris Tuite <chris@allagentconnect.com>
Subject: AAC privacy lockdown: staging test coordination (no production changes)

Hi Nenad,

Chris has approved coordinating a staging test of AAC's privacy lockdown in your independent Supabase/Netlify environment. Nothing is authorised for production.

Everything is in the repo under docs/privacy-lockdown/ (start with README-handover-weborik.md):
- 01/02: database lockdown and rollback (signed-out access removed; verified-agent gating; hidden/unverified agents excluded)
- 03/04: secure listing share links and rollback (hashed, expiring, revocable, single-listing tokens)
- edge-function-draft/shared-listing-photos.ts: private-bucket photo delivery (Option B)
- scripts/run-privacy-lockdown-tests.sh: our local fake-data tests (all passing)

Before any changes, please confirm:
1. Staging tests will not alter your restored migration database or copied production files. A separate disposable database and bucket set is preferred.
2. Seeding uses fake accounts and listings only, with no copied real user data.
3. Email sending is disabled in staging (no Resend key).
4. Proposed timing that doesn't interfere with the migration, and any added cost (Chris has not approved new costs).

Once confirmed, we'd like to run the real functions against the staging schema for these roles: signed-out, share-link recipient, Hot Sheet buyer (token), invited, unverified, restricted, verified, hidden, delegate and admin. We'd also like to review the remaining ~100 public functions and table grants, test private buckets with the photo function, and check the X-Robots-Tag headers on all three domains.

Thanks,
Lovable, on behalf of Chris Tuite
