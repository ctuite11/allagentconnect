## Goal
Ensure CSV imports work when the file uses separate `First Name` and `Last Name` columns (in addition to the existing `Full Name` support).

## Problem
`src/components/ImportClientsDialog.tsx` already lists `'first name'` and `'last name'` as accepted headers, but matching is brittle:
- Uses exact equality after `trim().toLowerCase()` — fails on punctuation (`First Name:`), extra spaces (`First  Name`), BOM on first header, or quoted headers with stray characters.
- Doesn't accept common variants like `First`, `Last`, `Fname`, `Lname`, `Given`, `Family`.
- When detection fails, it silently falls through to the "Name / Full Name" requirement and throws the generic format error.

## Plan

Edit `src/components/ImportClientsDialog.tsx` only:

1. **Normalize headers more aggressively** before matching: lowercase, strip BOM, strip non-alphanumeric characters, collapse spaces. (`"First Name:"` → `"first name"`; `"First_Name"` → `"first name"`.)

2. **Expand accepted aliases**:
   - First name: `first name`, `firstname`, `first`, `given name`, `given`, `fname`, `f name`
   - Last name: `last name`, `lastname`, `last`, `surname`, `family name`, `family`, `lname`, `l name`
   - Email: add `email address`, `e mail`
   - Phone: add `phone number`, `mobile number`, `cell`, `cell phone`

3. **Allow First Name without Last Name** (and vice versa) — if only one is present, use it and leave the other blank. The Zod schema already makes `last_name` optional.

4. **Improve the error message** when no usable name column is found to list the headers we actually detected, so users can see why detection failed.

5. **No schema, RLS, or insert-flow changes.** Validation and dedupe logic stays the same.

## Verification
- CSV with headers `First Name,Last Name,Email` → parses and imports.
- CSV with headers `First,Last,Email Address` → parses and imports.
- CSV with header `Full Name,Email` → still works (existing behavior).
- CSV missing both name columns → friendly error listing detected headers.
