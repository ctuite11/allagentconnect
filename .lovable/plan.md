# Make the Buyer Agent Compensation rate field wheel/trackpad safe

## The bug
On Add Listing / Edit Listing, the **Rate (%)** field is a browser number field. While it has focus, a mouse wheel or Mac trackpad scroll increments/decrements the value (2.5 → 2.4 → 2.6…) instead of just scrolling the page. An agent scrolling the form can silently change the offered compensation.

## Root cause (confirmed in code)
- `src/pages/AddListing.tsx` (~line 5826): the percentage branch of `commission_rate` uses `type="number"`. Number inputs change value on wheel while focused.
- The **Flat Amount ($)** branch on the same screen is already a text input with numeric input mode — wheel-safe.
- The rental form (`AddRentalListing.tsx`) uses `FormattedInput`, also a text input — wheel-safe.
- So only the one percentage field needs fixing.

## The fix (one field, one file)
Change the Rate (%) input in `AddListing.tsx` from `type="number"` to `type="text"` with `inputMode="decimal"`, mirroring the existing flat-fee pattern:

- Accept only digits and a single decimal point while typing (e.g. 2, 2.5, 2.25 all work).
- Keep `min 0 / max 100` validation at save time exactly as today — stored values, calculations, and existing listing data are untouched.
- Mobile still gets the decimal numeric keyboard via `inputMode="decimal"`.
- Page scrolling is unaffected: text inputs never consume wheel events.
- The existing spinner-arrow-hiding CSS stays, harmlessly.

No other compensation field needs changes (flat fee and rental are already text-based). No backend, template, or data changes.

## QA
1. Enter 2.5 in Rate (%), leave the field focused, two-finger scroll up/down on a Mac trackpad: page scrolls, value stays exactly 2.5.
2. Type 2, 2.5, 2.25 — all accepted; letters rejected.
3. Switch to Flat Amount and back — both fields behave as before.
4. Save a listing with 2.5% and reload — value round-trips unchanged.
5. Build + type-check pass.
