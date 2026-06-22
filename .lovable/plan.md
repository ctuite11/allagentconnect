## Problem

In Create hot sheet → Contacts, the blue **"Or add a new contact manually"** link disappears and the First Name / Last Name / Email / Phone fields render open by default. The expected behavior (and the original design) is: search box visible, blue link visible, fields hidden until the link is clicked.

Root cause is **state leaking across dialog open/close cycles**, not a layout change:

- `src/components/CreateHotSheetDialog.tsx` line 1285: `<Dialog open={open} onOpenChange={onOpenChange}>` passes the parent's `onOpenChange` straight through.
- When the user closes the dialog via the X button, Esc, or backdrop click, `resetForm()` is **never called** — it only runs after explicit Save / Cancel button paths (lines 1106, 1175, 1273, 2172).
- `showManualClientEntry`, `clientFirstName`, `clientLastName`, `clientEmail`, `clientPhone` therefore retain their last values. Next time the dialog opens, the manual entry branch is already true and the fields render pre-populated (matching the screenshot showing "john / smith" already in the inputs).

The render logic at lines 1472–1483 is correct; it just never gets back to `showManualClientEntry === false` between sessions.

## Fix

Reset transient contact-entry state every time the dialog is dismissed, regardless of dismissal path.

In `src/components/CreateHotSheetDialog.tsx`:

1. Wrap the outer `<Dialog>` `onOpenChange` (line 1285) so that when `next === false` we (a) call `resetForm()` if not in `editMode`, or (b) at minimum clear the contact-entry slice (`showManualClientEntry`, `showClientPicker`, `showClientDropdown`, `clientFirstName`, `clientLastName`, `clientEmail`, `clientPhone`, `existingClient`, `clientSearchQuery`, `clientSearchResults`, `errors` for those fields) before forwarding to the parent `onOpenChange(false)`. Edit mode keeps its loaded hot-sheet values but still resets the manual contact entry slice so the link comes back next open.

2. Belt-and-suspenders: add a `useEffect` keyed on `open` that, on the falling edge (`open` transitioning to `false`), runs the same contact-entry reset. This guards against future call sites that bypass the wrapped handler.

3. No changes to the JSX block at 1428–1582. The link/fields toggle already works once `showManualClientEntry` is false on open.

## Out of scope

- No visual / copy changes to the link, search box, or fields.
- No changes to `DuplicateContactDialog`, `handleSelectClient`, or the duplicate-resolution flow shipped earlier.
- No schema or RPC changes.

## Verification

1. Open Create hot sheet → click **Or add a new contact manually** → type "john smith / john@example.com" → close the dialog with the X.
2. Reopen Create hot sheet → expect: Search box + blue **Or add a new contact manually** link only. No First/Last/Email/Phone visible.
3. Repeat with Esc and backdrop click — same result.
4. Edit mode: open an existing hot sheet for edit → criteria and name still hydrate from the loaded record; the contacts panel still starts collapsed to the link.
5. Click the link → fields appear empty → type → click **Add This Contact** → contact added → fields collapse back to the link (already works via `setShowManualClientEntry(false)` on lines 909 / 1031).