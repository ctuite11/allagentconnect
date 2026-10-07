# Delete the three pending Hot Sheet invites

## Scope

Delete exactly the three pending first-batch invites identified in the read-only audit. Nothing else.

- kerri — chris.tuite@compass.com — 62 listings — queued Oct 7, 2:08 AM UTC
- sally 1 — chris.tuite@compass.com — 62 listings — queued Oct 7, 3:03 AM UTC
- dad — two recipients including chris.tuite@compass.com — 62 listings — queued Oct 7, 3:58 AM UTC

## Steps

1. Re-verify read-only: re-query the pending batch rows to confirm exact IDs, that none have queued a first batch, and that no email jobs reference them.
2. Delete only those rows by explicit ID.
3. Verify after: rows gone, email queue count unchanged, no other Hot Sheet data touched.

## Explicitly not done

- No emails, invitations, or sends of any kind.
- No changes to the Hot Sheets, their contacts, criteria, or matching.
- No changes to the older waiting batches, the failed May invite, or the Sept 21 activation-reminder job.
- No code changes.

## Technical notes

- Deletion uses explicit row IDs captured in step 1, so the exact rows removed are reported back.
- If step 1 shows any of the three has since queued an email, I stop and report instead of deleting.
