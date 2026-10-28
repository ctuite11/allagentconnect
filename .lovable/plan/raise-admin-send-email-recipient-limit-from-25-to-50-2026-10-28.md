# Raise Admin Send Email recipient limit from 25 to 50

## What changes
- Admin → Send Email will accept up to 50 addresses in one send, up from 25. Your list of 36 will go out in a single send.
- Everything else stays the same:
  - Every address is checked before anything sends.
  - Each person gets their own separate email.
  - A retry goes only to the addresses that failed.
  - Confirmations say "Queued successfully".
- Only this page changes. No backend or email queue changes, and no emails are sent during testing.

## Technical details
- `src/lib/parseRecipientList.ts`: change `MAX_RECIPIENTS` from 25 to 50.
- `src/lib/parseRecipientList.test.ts`: the cap test follows the constant. Add a check that 36 addresses are accepted and 51 are flagged. Run the test.
