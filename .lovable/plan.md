## Status: code done, verification not done

**Completed**
- Shared matcher `communicationPreferencesMatcher.ts` (independent-dimension AND, full geo: state/county/city/zip/neighborhood, price intersection, type intersection, ZIP sentinels ignored, `has_no_min`/`has_no_max` non-restrictive).
- `verifiedAgentAudience.ts` extended with `savedPrefs`; `preferences_set` is now derived.
- Rewired callers: `notify-agents-client-need`, `notify-agents-new-listing`, `send-client-need-notification`.
- 11 matcher unit tests passing.
- Audit projection for Frank's Marina Bay broadcast: **61 recipients** (45 unset fallback + 16 matched, 1 non-match = Patrick Bateson single-family only).

**Not done yet**
1. `notify-agents/index.ts` (generic dispatcher — the path Frank's broadcast actually used) — still on old logic.
2. `send-seller-alert/index.ts` — still on old logic.
3. Edge functions not deployed.
4. `dry_run: true` against the three recent broadcasts (Frank Marina Bay → expect 61; Anthony Maiullari Cambridge/Somerville $425k; Chris Tuite MA-only) not executed.
5. Queue is still paused. No resend of Frank's broadcast.

## Proposed next steps (still audit-only until dry-run approved)

1. Wire the shared matcher into `notify-agents/index.ts` and `send-seller-alert/index.ts` using the same pattern as the three already-updated callers. Event shape:
   - `notify-agents`: pass through the broadcast criteria payload (`state`, `county`, `city`, `zip`, `neighborhood`, `propertyTypes`, `minPrice`/`maxPrice` or `price`).
   - `send-seller-alert`: build event from the seller alert row's geo + price + `propertyTypes`.
2. Deploy the five updated edge functions.
3. Run `dry_run: true` on the three broadcasts and post the count table in chat.
4. Wait for approval before unpausing the queue. No backfill/resend of Frank's broadcast unless you explicitly ask.

No schema changes, no UI changes, no live sends in this step.
