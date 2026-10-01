# Social publishing stays in test-only mode — no launch

## Confirmed current state (verified this turn)
- `SOCIAL_LAUNCH_OPEN` is **not set** in the backend secrets, so the server-side launch gate is closed.
- `SOCIAL_TEST_USER_IDS` is also not set, so today **only AAC admins** can use any social-publishing endpoint.
- The gate lives server-side in `supabase/functions/_shared/bundleSocial.ts` (`authenticateGated`): launch flag → admins → named test accounts → everyone else refused, even calling the endpoint directly.

## What this plan does
Nothing changes. This plan records the approved safe state:

1. **Social publishing is NOT approved for launch.** `SOCIAL_LAUNCH_OPEN` stays unset/false.
2. **Access stays restricted** to admins and explicitly named test accounts only.
3. **No real social activity during QA.** No real social account connect/disconnect and no social post. Normal listing publishing remains unchanged.
4. **Profile social links stay live.** They are public links only — separate from publishing authorization.
5. **The "Ready to publish?" social section stays hidden for normal agents.** The frontend already hides it when the server refuses access (`fetchSocialConnected()` returns null → section not rendered).
6. **The server-side gate is not removed or weakened.** It stays exactly as implemented.

## If a named test account is ever needed
Only with your explicit approval: add that account's user ID to `SOCIAL_TEST_USER_IDS`. Not part of this plan.

## Launch, when approved later
Do **not** simply turn on `SOCIAL_LAUNCH_OPEN` until we first confirm the launch gate should allow only the intended AAC agent/member population. The current `true` behavior permits **any authenticated user** — that access rule needs review and likely tightening before launch. Launch requires Chris's explicit approval and a final access-rule review. This is a pre-launch fix, not something to change now.
