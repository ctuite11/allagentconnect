## Goal

On the buyer-side Share Listing dialog (`senderProfileSource === "buyer"`), after a recipient email is added, the manual email entry field should remain visible so the user can add additional recipient emails. Currently it disappears because the buyer-side caller passes `maxRecipients={1}`, which hides the picker once one recipient is selected.

## Change

In `src/components/ShareListingDialog.tsx`:

- Replace the hard-coded `maxRecipients={1}` with a value conditional on sender source: `maxRecipients={hideContactSearch ? undefined : 1}`.
  - Buyer-side: no max → after adding an email, the email input stays visible (because `showRecipientPicker = !singleRecipientMode || !hasActiveRecipient` becomes true).
  - Agent-side: unchanged (still 1 recipient max).

No other files change. `ShareListingsDialog` already:
- Renders the chips list of added recipients above the picker.
- Resets `recipientEmail` via `clearPendingRecipientFields()` after a successful add, so the input is empty and ready for the next email.
- Allows removing any recipient via the X button on each chip.
- Prevents duplicate emails.

## Out of scope

- No visual redesign of the recipient chips or input.
- No changes to agent-side share behavior.
- No backend/email-sending changes (handler already iterates `recipients`).
