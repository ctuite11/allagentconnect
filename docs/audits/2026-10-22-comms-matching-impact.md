# Communications matching impact review — 2026-10-22

## Decision: do not deploy the proposed shared patch yet

Read-only database review and local comparisons completed. No preferences, production matching code, database records, email queues, functions, or templates were changed. No send functions were invoked. Deployment is not approved.

## Named impact

Compared the current matcher with the proposed isolated `/tmp/mt/m.ts` implementation against all 43 Communications posts since August 1 and all six agents with notification-source town+county rows. Applied the live audience definitions (verified, activated or signed in, agent role, names, visibility or explicit hidden opt-in), email presence, unsubscribe exclusion, both master switches, category, sender exclusion, geography, price, property types, and current cadence. Coverage ZIP placeholders were discarded, as in production.

These are retrospective eligibility comparisons using current preferences, not historical delivery counts or a resend list. Delivery-time suppressions, pauses, and provider acceptance are not certified by this calculation. The helper references `public.suppressed_emails`, but that table is absent in the current database; do not invent a clean suppression result from that failed lookup. The existing unsubscribe table was checked and none of the six is listed. Stored broadcast records omit the separate audience_scope request value, so the historical simulation uses targeted semantics, not an assertion about the original request mode.

| Agent | Newly qualifying post comparisons | Current cadence | Oct 20 Boston/Newton |
| --- | ---: | --- | --- |
| Chris Tuite | 13 | Immediate | Yes, Boston |
| Walter Rivera | 19 | Immediate | Yes, Newton |
| Charles Cherney | 5 | Weekly | No |
| Maria Babakhanova | 2 | Daily | No |
| Rob Del Greco | 2 | Daily | No |
| Eliott Levine | 0 | Daily | No; neighborhood remains required |

Four other agents have newly qualifying comparisons across this sample, not five or six. Only Walter joins Chris for the Oct 20 post. Walter's change is due to Newton/Middlesex, not Boston/Suffolk. Charles's matches are Cambridge/Somerville; Maria's are Worcester-area towns; Rob's are Essex towns. No previously matching comparison was removed.

Chris's current saved notification area remains Boston/Suffolk/MA, minimum $1,000,000, no maximum, all eight types, all four channels true, both masters true, explicit hidden opt-in true, immediate cadence. His Oct 20 sent-record count is zero. Actual future Communications delivery is still unverified. One historical renter post has a minimum but no maximum and therefore overlaps $1M under the existing unbounded-range rule; the patch does not change price handling.

## Safety findings

1. The shared change affects every matching town+county, not just Boston/Suffolk.
2. It also affects `notify-agents-client-need` and `send-seller-alert`, not just core Communications broadcasts. Hidden opt-in remains core-only, so those paths still exclude Chris.
3. A direct event with Boston/Norfolk fails, but the actual broadcaster splits cities and counties into separate events. The proposed patch accepts the Boston-only branch of a Boston + Norfolk payload and loses the original county conflict. Confirmed locally. This must be safeguarded before claiming no unintended expansion.
4. Missing or conflicting state remains blocked when a saved state exists; county-only, state-only, ZIP and neighborhood restrictions are not relaxed.
5. `notify-agents` is county-only and unchanged; its dry run still writes a rate-limit record and was not invoked.
6. Existing digest items are not rematched geographically. Broadcast resend uses original recorded recipients and cannot add previously omitted agents through this patch. No resend or backfill is authorized.

## Tests and no-send proof

All 15 existing/proposed local matching assertions passed (4 new plus 11 existing). Five additional edge assertions passed, and the conflicting-county broadcaster risk was reproduced. Tests used Node assertions under Bun with a local Deno.test shim; no hosted function or database write was used.

Read-only before and after totals were identical:

| Record set | Before | After |
| --- | ---: | ---: |
| email_jobs | 17,252 | 17,252 |
| comms_broadcasts | 67 | 67 |
| agent_sent_broadcasts | 7,892 | 7,892 |
| comms_digest_items | 358 | 358 |
| comms_broadcast_resends | 0 | 0 |

Production Communications delivery exists for other recipients this month (671 delivered, 6 sent, 8 bounced), but that does not prove Chris's inclusion or future provider delivery. No test emails were sent.

## Approval gate and follow-up

Before asking for deployment approval, present a narrowed Communications-only proposal that preserves explicit county conflicts and leaves seller/legacy alert behavior unchanged, then retest its named impact. Preserve every preference. After separate deployment approval, validate Chris's production eligibility without sending, and verify a genuinely new qualifying post reaches his queue and provider-delivered status. Actual receipt remains pending a new qualifying post; do not synthesize one or replay old posts.

## Source references

- `_shared/communicationPreferencesMatcher.ts`: location and dimension rules.
- `_shared/verifiedAgentAudience.ts`: notification-only preference sources, hidden opt-in and suppression.
- `_shared/commsOptIn.ts`, `_shared/commsDigest.ts`: permission and cadence.
- `send-client-need-notification/index.ts:190–238`: separated geographic event expansion.
- `notify-agents-client-need/index.ts`, `notify-agents/index.ts`, `send-seller-alert/index.ts`: other runtime callers.
- `process-comms-digests/index.ts`, `resend-comms-broadcast/index.ts`: existing-item and original-recipient behavior.