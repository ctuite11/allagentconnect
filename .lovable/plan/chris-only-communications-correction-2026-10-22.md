# Chris-only Communications correction

## Prepared results
- Current preferences remain Boston/Suffolk/MA, $1M minimum, no maximum, all eight property types. All four channels, both master switches, hidden-account opt-in and immediate delivery are enabled.
- Separate local proposal: 16 safeguards passed; all 11 existing matching assertions passed. No application matching code changed, no emails sent or queued, nothing deployed.

## Specific correction
For your account only, recognize a post explicitly naming Boston, MA as Boston/Suffolk when the county is missing. Boston's county comes from an independent geographic reference, not from changing or ignoring your preferences.

If the original post supplies a conflicting, unknown or mixed county, do not apply the correction. Preserve price, property type, state, ZIP and neighborhood restrictions. Other towns and statewide posts are not broadened.

## Restrict it to your account
Require both your permanent account identifier and chris@allagentconnect.com from the existing recipient records. Every other account uses the exact existing matching decision. No caller can select a different correction recipient.

Only future core Communications broadcasts use this correction. Shared matching, seller alerts, Hot Sheets, existing digests, resends, templates and queue processing stay unchanged. Everyone's preferences remain untouched.

## Implementation and checks after approval
1. Add the account-only correction without changing the shared matching rule.
2. Test the complete recipient selection locally with no sends or database writes. Compare all other agents' recipients, timing, reminder/copy handling and email-job contents before and after; require identical results. Only your account may newly qualify.
3. Check your actual email blocks and pause state read-only. One existing suppression lookup references a missing table, so a clean suppression result is not yet certified. Stop if it cannot be reconciled without broader changes.
4. Deploy only the isolated correction if those checks pass and deployment is explicitly approved. No broader rollout is included.

## Verify delivery
After approved deployment, confirm your eligibility read-only and track a genuinely new qualifying post through your email job and provider-delivered status. Confirm receipt with you. Other agents' normal notifications remain unchanged; no test, resend or backfill reaches them.

A controlled test is optional, not scheduled or sent by this proposal. If necessary, present the exact action first and enforce one sole destination: chris@allagentconnect.com, no copies or other recipients. Never use the multi-agent broadcaster for a test. A test email alone does not prove future matching.

## Technical details
- Proposed hook: `send-client-need-notification` recipient matching, after existing network-wide/no-criteria guards.
- Account gate: UUID `1fc50da1-2664-4931-8cab-64e24dc5ed8c` plus normalized email.
- Read county conflicts from original `parsedCriteria`, before geographic event splitting; supplement with one known Boston/MA/Suffolk event and run the unchanged matcher against original saved restrictions.
- Prototype/report: `docs/audits/comms-chris-only-proposal.test.ts` and `docs/audits/2026-10-22-comms-chris-only-proposal.md`. Prototype is not imported by production.

Approval applies only to this account-specific correction and the checks above. Broader matching or additional-agent delivery requires separate approval.
