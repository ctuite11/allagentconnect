# Verify Copy setup link (30-day, silent) — read-only

Verification only. No real member account is touched, no token is issued or revoked, no email sent or queued, no code changes, no migrations, no redeploys, no publish.

## Checks (read-only)

From the deployed function source and the database function definitions:

1. Unactivated members take the 30-day activation path and produce `/activate#t=...`.
2. Activated members take the 30-day login path and produce `/signin-link#t=...`.
3. Copy setup link calls only the no-email issuance variants.
4. The no-email variants create no email queue row.
5. Token expiry is 30 days on both paths.
6. Only the token hash is persisted; the plaintext link never leaves the function.
7. Issuing a token revokes/replaces any previous live token for that member, as designed.
8. Email setup link behavior unchanged.
9. License Verified email behavior unchanged.
10. Drawer wording is exactly "AAC activation/setup link (30 days, single-use)".
11. No "~1 hr" or Supabase-recovery wording remains in current source.

## Also run

- Type check
- Production build

## Out of scope

Issuing tokens, calling Copy setup link for a real agent, sending or queueing email, code changes, migrations, deployments, publishing.
