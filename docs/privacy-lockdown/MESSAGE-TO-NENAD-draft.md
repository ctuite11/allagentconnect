To: Nenad (Weborik)
Cc: Chris Tuite <chris@allagentconnect.com>
Subject: AAC privacy lockdown: staging test coordination (no production changes)

Hi Nenad,

Chris has approved coordinating a staging test of AAC's privacy lockdown in your independent Supabase/Netlify environment. Nothing is authorised for production, and nothing will be changed in your environment without your agreement.

Everything is in the repo under docs/privacy-lockdown/ (start with README-handover-weborik.md, then 05-decisions-and-public-function-review.md):
- 01/02: database lockdown and rollback (signed-out access removed; verified-agent gating; hidden/unverified agents excluded)
- 03/04: secure listing share links and rollback (hashed, expiring, revocable, single-listing tokens)
- 05: Chris's decisions and the public-function review (104 functions callable by signed-out visitors, 49 privileged with no auth check, with proposed treatment)
- edge-function-draft/shared-listing-photos.ts: private-bucket photo delivery (Option B)
- scripts/run-privacy-lockdown-tests.sh: our local fake-data tests (all passing)

Chris's decisions affecting the build:
- No photo grace period. Confidential photos move to private buckets in the security release. Old email images will stop displaying. The links in those emails keep working if valid, and photos load only after the link is opened. If your hosting can serve a neutral "View photos securely" placeholder at the old image paths, we'd like to use it.
- Buyers see the sharing agent ("Your Agent"/"Shared by"), never the listing agent automatically.
- External sharing requires an explicit per-listing permission (default off). AAC agent visibility alone does not allow external sharing.
- Expired, revoked or obsolete links show a neutral page with no property data or preview metadata.

Before any changes, please confirm:
1. Staging tests will not alter your restored migration database or copied production files. A separate disposable database and bucket set is preferred.
2. Seeding uses fake accounts and listings only, with no copied real user data.
3. Email sending is disabled in staging (no Resend key).
4. Proposed timing that doesn't interfere with the migration, and any added cost (Chris has not approved new costs).

Once confirmed, we'd like to run the real functions against the staging schema for these roles: signed-out, share-link recipient, Hot Sheet buyer (token), invited, unverified, restricted, verified, hidden, delegate and admin. We'd also like to manually review all 104 public functions and table grants, test private buckets with the photo function, test the agent and buyer share-link screens, and check the X-Robots-Tag headers on all three domains.

Thanks,
Lovable, on behalf of Chris Tuite
