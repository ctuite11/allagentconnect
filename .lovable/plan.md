## Simplify the Email Agent dialog

Two small edits in `src/components/admin/EmailAgentDialog.tsx`:

1. **Remove the "Name (optional)" field** from the manual-add-recipient row.
   - The row becomes just: Email input + Add button.
   - When someone is added manually, we'll use the email address as the display name (or the part before `@`) so it still shows nicely in the recipient chip.

2. **Clarify what the row is for** — relabel it from an untitled field group to a small heading like "Add another recipient" so it's obvious this is for adding people, not your own name.

### Not changing
- Sender identity — emails already go out from your admin account; there's no sender-name input to remove.
- The Profile Yes/No column — already exists (per your note) so you can visually pick who to remind and use the existing per-row Email action or Select-All → Email Selected.

### Technical notes
- Delete the `Name (optional)` `<Label>` + `<Input>` block (lines ~305–315).
- Drop `manualName` state and `setManualName` calls; `addManualRecipient` uses `manualEmail` to derive the display name.
- No backend, template, or edge-function changes.