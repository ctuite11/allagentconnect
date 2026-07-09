## Add a "Complete Your Profile" reminder template to the dropdown

In `src/components/admin/EmailAgentDialog.tsx`, add a new option to the Template dropdown. Unlike the four existing pre-built templates (which ignore the message body and send a fixed HTML design), this one behaves like a saved snippet: it pre-fills the Subject and Message fields, and both stay fully editable.

### Dropdown entry
- Value: `profile-reminder`
- Label: **"Complete Your Profile — Reminder"**
- Placed right under "Custom message".

### On select, pre-fill

**Subject:** `Complete your All Agent Connect profile`

**Message** (the greeting line is intentionally omitted — the bulk-send function auto-prepends `Hello {first name},` per recipient, so we don't hardcode "Ryan"):

```
This is a quick reminder to complete your agent profile and communication preferences on All Agent Connect.

Agents without a completed profile do not appear in the Agent Network and will not be eligible to receive seller and buyer leads as we roll out these new features.

Completing your profile and setting your communication preferences only takes a few minutes and ensures you can take full advantage of the network.

Complete your profile today to make sure you're visible and eligible for new opportunities.

Best,

Chris
All Agent Connect
```

### Behavior
- Selecting the template fills Subject + Message.
- Both fields remain editable before sending.
- Message is NOT ignored (unlike the four "pre-built" templates) — what you see is what gets sent.
- Works for both single-recipient (per-row Email) and bulk (Email Selected).

### Technical notes
- Add the `SelectItem` in the template `<Select>`.
- In the `onValueChange` handler, add a branch for `profile-reminder`: set subject if empty, overwrite message with the block above.
- No changes to `isTemplated` — this stays a Custom-style editable template.
- No backend, edge-function, or React Email template changes.