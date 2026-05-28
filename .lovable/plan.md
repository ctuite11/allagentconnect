## Goal
Mailing list CSVs typically have a single "Name" (or "Full Name") column instead of separate First/Last columns. Today the importer accepts a `Name` column as a fallback, but validation still requires `last_name` to be non-empty, so single-word names ("Cher", "Madonna", or a company name) get rejected, and the error message still demands "First Name" and "Last Name".

## Changes to `src/components/ImportClientsDialog.tsx`

1. **Expand full-name header detection**
   - Recognize `name`, `full name`, `fullname`, `contact name`, `client name` as the full-name column.

2. **Relax required-column error**
   - When neither First/Last nor a full-name column is present, throw: "CSV must include either a 'Name' (or 'Full Name') column, or both 'First Name' and 'Last Name' columns, plus 'Email'."

3. **Loosen schema for last name**
   - Change `last_name` in `clientRowSchema` to `z.string().trim().max(100).optional().or(z.literal(""))` so single-token full names (e.g. "Cher") still validate.
   - `first_name` stays required (we always have at least one token from the full name, or the row is meaningless).
   - Insert payload sends `last_name: client.last_name || ''` to satisfy the DB column.

4. **Full-name parsing edge cases**
   - If the full-name cell is empty, skip the row (don't push an invalid client).
   - Trim collapsed whitespace; keep current "first token = first_name, rest = last_name" behavior.

## Out of scope
- No DB schema changes.
- No changes to dedupe, AAC-registration check, office_id handling, or UI layout beyond the help-text line that lists required columns (updated to: "Required: Name (or First Name + Last Name), Email").
