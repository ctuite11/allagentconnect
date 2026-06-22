## Problem

In the Create Hot Sheet dialog, when an agent manually adds a buyer (e.g. "John Smith / doittuite8@yahoo.com") and that email already exists in their CRM (Debbie), the code silently calls `handleSelectClient(existing)` and attaches Debbie instead of John. The agent sees a brief "already exists" toast but the hot sheet is built around the wrong contact.

Source: `src/components/CreateHotSheetDialog.tsx`, `handleAddManualContactClick` (line ~908) and the duplicate branches in `handleCreateClient` (lines ~963, ~996, ~1030).

## Fix — Duplicate Contact Resolution dialog

When manual add detects an existing client with that email, **stop and show a small dialog** instead of silently attaching. The dialog shows the existing contact and gives the agent two clear actions plus Cancel.

### Dialog contents

- Title: **This email is already in your contacts**
- Body: existing contact card showing first/last name, email, phone, and a subtle "Added <relative date>" line. Subtext: "doittuite8@yahoo.com is already attached to Debbie Buyer. What would you like to do?"
- Actions:
  1. **Add Debbie to this hot sheet** (primary) — calls existing `handleSelectClient(existing)`, closes both dialogs, returns to the hot sheet form.
  2. **Delete this contact** (destructive, with inline "Are you sure?" confirm step) — calls the existing `agent_end_client_relationship` RPC (already orphan-safe + audited per the recent hardening migration). On success, leaves the manual-add form populated with the agent's typed values (John Smith / email / phone) so they can click **Add contact** again and it will now insert cleanly.
  3. **Cancel** — closes the dialog, leaves the manual-add form intact so the agent can edit the email.

### Critical scope on "Delete this contact"

The destructive action is **scoped to this agent only**. It must NOT delete the buyer's auth user when that email belongs to an active buyer for another agent.

- Path used: `agent_end_client_relationship(p_client_id)` RPC, which already:
  - Ends only the calling agent's `client_agent_relationships` row.
  - Cascades only this agent's hot_sheet data / share_tokens / 1:1 conversations.
  - Clears `clients.client_type` (CRM-soft-remove) but does NOT hard-delete the `clients` row.
  - Calls `revoke-buyer-auth` which, per the recent hardening commit, skips `auth.admin.deleteUser` when another agent still has an active relationship keyed by either `client_id` or `crm_client_id`.
- Do NOT call any direct `from('clients').delete()` or `auth.admin.deleteUser` from the dialog. The dialog only invokes the RPC.
- Toast copy on success: "Contact removed from your CRM." (Do not say "deleted" — emphasizes per-agent scope.)

### Behavior changes in `CreateHotSheetDialog.tsx`

- `handleAddManualContactClick`: when `existing` is found, set `duplicateExistingClient` state and open the new dialog instead of calling `handleSelectClient`.
- `handleCreateClient`: same change in the three duplicate branches (pre-insert lookup, `isDuplicateClientEmailError` from insert, and the catch block). Never auto-attach.
- After successful "Delete this contact": refresh agent contacts cache, close duplicate dialog, keep `showCreateClientDialog` open so the agent can retry create.
- After "Add to hot sheet": keep current behavior (attach existing, clear manual form, close pickers).

### New component

`src/components/hot-sheets/DuplicateContactDialog.tsx` — small controlled `<Dialog>` matching the existing dialog styling (same tokens as `AddHotSheetRecipientDialog`). Props: `open`, `onOpenChange`, `existingClient`, `typedName`, `onAddToSheet`, `onDeleted`. Internal two-step confirm for the destructive action.

### Out of scope

- No schema changes (uses the existing `agent_end_client_relationship` RPC and existing `revoke-buyer-auth` cross-agent safety).
- No changes to the Hot Sheets page, the recipient picker, or any other flow.
- No changes to how brand-new (non-duplicate) contacts are created.

## Verification

1. With Debbie still in the CRM, open Create Hot Sheet → Add contact manually → type "John Smith / doittuite8@yahoo.com" → expect the new Duplicate Contact dialog, NOT silent Debbie attach.
2. Click **Add Debbie to this hot sheet** → Debbie appears in the selected list, dialog closes.
3. Re-open, repeat, click **Delete this contact** → confirm → Debbie is removed from this agent's CRM (audit_logs row written by the RPC) → manual-add form still shows John's typed values → clicking **Add contact** now inserts John cleanly.
4. Cross-agent safety check: seed a second agent with an active relationship to the same buyer email, run **Delete this contact** as the first agent, then confirm the buyer's `auth.users` row still exists and the second agent's relationship is untouched.
5. Cancel path leaves the form editable with no side effects.
