# Communications Center emails for chris@allagentconnect.com

## Live check (read-only, Oct 22)
- All four channels on: Buyer Needs, Renter Needs, Sales Intel, General Discussion.
- `client_needs_enabled` = true and `new_matches_enabled` = true.
- Hidden-account exception (`comms_email_when_hidden`) = true.
- Other filters: all 8 property types, minimum price $1M, no maximum.
- Email delivery works: 22 emails to you in the last 14 days, all sent. They were Hot Sheet match and verification emails, and none were Communications Center emails.

## Root cause (confirmed earlier)
You saved your area as "Boston, Suffolk County". Boston Buyer Need posts store the town with no county. The matching step requires every saved part to match, so a post with no county fails you on location. Your settings are fine and none need changing.

One more filter to know about: your $1M minimum also screens out lower-priced posts. That's your own choice, so I'll leave it as is.

## Proposed fix (needs your approval)
1. Update the shared matching rule: when a post has no county but its town matches your saved town (and state, if the post has one), count it as a location match.
2. Add tests: Boston-with-county saved + Boston post without county = match; a different town still fails; a county mismatch when both sides have a county still fails.
3. Redeploy the functions that send Communications Center emails, so they pick up the new rule.
4. No-send dry runs on recent Boston posts. Confirm you would now be included, and count how many other agents would newly match (about 6 earlier).

## Will not do
No preference changes for you or anyone else. No resends of old posts, no test emails, and no queue changes.

## Technical
- File: `supabase/functions/_shared/communicationPreferencesMatcher.ts` → `locationPasses`: skip the county comparison when `eCounty` is empty and `rCity` matches `eCity`.
- Test: `communicationPreferencesMatcher.test.ts`.
