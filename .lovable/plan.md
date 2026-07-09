## Remove the manual "add recipient" input entirely

In `src/components/admin/EmailAgentDialog.tsx`, remove the whole manual-add block from the dialog — the email input, the Add button, and the wrapping container (lines ~300–331).

Also clean up the now-unused code:
- `manualRecipients` state and `setManualRecipients` calls (including the reset in the send handler and the initial state).
- `manualEmail` state and `setManualEmail`.
- `addManualRecipient` function.
- `removeManualRecipient` function and the per-chip remove `X` button (only manual recipients could be removed; with manual add gone this is dead code).
- Update `allRecipients` to just be `recipients` (no more merging with manual).

### Result
The recipients section shows only the agents you selected on the admin page. No inputs, no Add button. If you need to email someone extra, you'd add them via the admin table instead.

### Not changing
- Sender identity, template picker, subject, message, batch controls — all untouched.