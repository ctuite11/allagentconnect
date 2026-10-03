# Send Alice Miles a new sign-up link (admin-created account)

## Current state (verified)
- Alice Miles (alice.miles@nemoves.com) is fully removed: no auth account, no agent profile, no pending verification request.
- A "previously deleted" tombstone exists for her email, so the system will ask for a one-time confirmation before recreating her.
- The existing admin flow already does everything needed: **Admin Approvals → Create Agent** creates the account and automatically sends the standard "Your account is ready" invite email with her secure setup link (hash-only, single-use, 30-day token).

## Plan — no code changes, no new emails, uses the existing flow

1. In the app, signed in as admin (Chris), open **Admin → Approvals** and click **Create Agent**.
2. Enter: Alice Miles, alice.miles@nemoves.com.
3. The dialog will flag that this email was previously deleted — confirm the acknowledgement to proceed (this is the built-in safety check working as intended).
4. Submit. The system will:
   - Create her auth account (email confirmed, no password — she sets it herself).
   - Create her agent profile with status "invited".
   - Send her the standard admin-created invite email from Chris with the secure account-setup link.
5. Verify afterwards (read-only): her account exists with status "invited", and exactly one invite email job was queued/sent to her address.

## What this does NOT do
- No code or template changes (email templates remain frozen).
- No password is set or logged — Alice creates her own via the setup link.
- No Hot Sheet, listing, social, or DCMLS activity.
- She is not verified — she completes profile + license setup herself, then goes through normal verification.

## Alternative
If you'd rather not click through the UI, I can invoke the same admin-create-user function directly with the admin session (with the previously-deleted acknowledgement). Same result, same email.
