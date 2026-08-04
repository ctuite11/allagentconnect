# Step 2 — Close the provenance gaps (Step 1 audit complete)

Step 1 confirmed every displayed Agent Network member (291 individuals + 1 approved team tile) was admin-verified. Two follow-ups remain. No access or email logic changes are included here.

## 1. Attest the 21 legacy accounts
These accounts were created 06-29 to 07-02, before the oldest surviving `pending_verifications` row (2026-07-02 17:21 UTC). Their access-request record was lost to retention, not bypassed.

- Record an admin attestation per account in the existing verification audit trail, action `provenance_attested`, noting "pre-retention legacy; admin-verified + License Verified email on file".
- No status, role, activation, or email changes.
- Result: every displayed agent carries an explicit, durable provenance record.

## 2. Decide the 89 verified-but-never-activated tiles
These appear in the directory only through the `company <> ''` fallback in `get_verified_agent_ids()` — visible without ever completing account setup.

Two options, to be chosen before any change:
- **A. Keep visible** — leave the fallback as is; document it as intentional.
- **B. Require activation** — drop the company fallback so only activated agents display. This removes 89 tiles from the public Network.

## 3. Full evidence export
Generate the complete 291-row provenance CSV (name, email, user ID, auth created, access-request evidence and timestamp, admin verification evidence and timestamp, setup-link evidence and timestamp, role, verification status, activation timestamp, classification, anomalies) as a downloadable admin export for the record.

## Technical notes
- Displayed set is defined by `public.get_verified_agent_ids()` plus the non-blank name filter in `src/pages/OurAgents.tsx`.
- Evidence sources: `pending_verifications`, `agent_early_access`, `agent_verification_audit`, `agent_activation_tokens`, `email_jobs` (License Verified / "account is ready"), `auth.users`, `agent_settings`, `deleted_users`.
- `agent_invites` is empty (0 rows); direct-invite proof relies on activation tokens and setup emails.
- Nothing here touches email jobs, queues, crons, or the Comms Center pause flags.