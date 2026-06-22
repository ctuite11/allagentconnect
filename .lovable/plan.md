## Answers

**1. Was `doittuite8@yahoo...` (Debbie) deleted?**
Yes. I checked the database — there is no `clients` row with that email anymore, and there are zero orphan rows in `client_agent_relationships` referencing a missing CRM contact. The delete flow worked cleanly, which is why re-adding the same email didn't error.

**2. Cancel option on the duplicate-contact confirmation**
Today the duplicate dialog only has a top-level `Cancel` (closes the dialog and returns to the manual-add form). Once the agent clicks **Delete contact**, the dialog swaps to a "Remove from CRM?" amber confirmation panel with only **Remove from CRM** as the action — there is no way to back out of that confirmation without closing everything, and the top Cancel button is easy to miss in that state.

## Plan — `src/components/hot-sheets/DuplicateContactDialog.tsx` only

Scope: UI/copy only. No business logic, no schema, no RPC changes.

1. **Add a `Back` button inside the confirmation step.**
   When `confirmingDelete` is true, render a `Back` (ghost) button next to `Remove from CRM` that calls `setConfirmingDelete(false)`. This returns the agent to the duplicate choice screen (Add existing / Delete contact / Cancel) without losing context.

2. **Rename the top-level `Cancel` to `Back to form`** so it's obvious the manual-add form (with the values the agent already typed) is preserved when they want to edit the email/name and try again. No behavior change — still calls `onOpenChange(false)`; parent already retains form values per the existing spec.

3. **Disable the `Back` and `Back to form` buttons while `deleting` or `adding`** is in-flight (same pattern as existing buttons), so the agent can't navigate away mid-request.

4. No changes to `handleDelete`, `handleAdd`, RPC calls, toast copy, or any other component.

### Resulting footer states

- Choice screen: `Back to form` · `Delete contact` · `Add <name> to sheet`
- Confirmation screen: `Back to form` · `Back` · `Remove from CRM`

That's the whole change.