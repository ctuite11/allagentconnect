# Edit Draft: show original placeholders for untouched fields

## What the agent will see
Reopening an incomplete Draft shows blank fields with the normal placeholder text (as on a new Add Listing form) instead of `Draft`, `TBD`, `00000`, or `$0`. Anything the agent actually typed still appears.

## Known filler values (confirmed in the save code)
Drafts are saved with these stand-ins only so the record can be stored:
- Street Address: `Draft` (sale and rental forms)
- City/Town: `TBD` (sale form)
- ZIP Code: `00000` (sale form)
- Listing Price / Monthly Rent: `0` (sale and rental forms)

State defaults to `MA`. That is a real default selection, not filler, so it stays as is.

## Change
- Add one small shared helper that turns a loaded value back to blank **only when the listing's status is `draft`** and the value exactly matches one of the filler values above (address `Draft`, city `TBD`, ZIP `00000`, price/rent `0`).
- Use it where a saved draft loads into the form on the Add/Edit Listing screen (sale and rent), and in the rental draft reopen path if it loads saved drafts.
- Saving still writes the same filler values to the database when a field is blank, so draft saving works the same.
- Published and live listings are never normalized. Real entries are never cleared. That includes a street name typed by the agent, even an unusual one. Placeholders on new Add Listing forms stay the same. Save Draft and Publish validation stay the same.

## Tests
Unit tests for the helper:
- Each filler value on a draft becomes blank.
- The same values on a non-draft listing stay as they are.
- Real values (e.g. `12 Main St`, `Boston`, `02129`, `750000`) stay as they are.

## QA
Save an incomplete draft and reopen it. Every untouched field should show its normal placeholder. Type-check and build should pass. No backend, email, publishing, or stored-data changes.
