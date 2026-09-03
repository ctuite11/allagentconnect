# Match emails to the 669 not-in-database agents

## Goal
Cross-reference the 669 names in `aac-agents-not-in-database.xlsx` against the email spreadsheets built earlier (`aac-invite-emails.xlsx` — 135 emails with names, and `aac-invite-emails-132-new.xlsx`), since both came from the same Facebook group screenshots. Add matched emails to the agent spreadsheet.

## Steps
1. Load `aac-agents-not-in-database.xlsx` (669 rows) and `aac-invite-emails.xlsx` (Name + Email columns).
2. Match with two confidence tiers:
   - **Confident**: email local-part clearly contains first + last name (e.g. `jsmith@`, `john.smith@`, `johnsmith.re@`) or the transcribed name on the email sheet matches.
   - **Possible**: last name only, initials + last name, or partial overlap — flagged for your review.
3. Add columns to the agent spreadsheet: `Matched Email`, `Match Confidence` (Confident / Possible), `Email Source Sheet`.
4. Save as an updated `aac-agents-not-in-database.xlsx` (and keep a matched-only summary tab).
5. Report: counts of confident vs possible matches, and how many agents remain without an email.

## Guardrails
- No emails sent; this is spreadsheet work only.
- Existing rows/columns preserved; only new columns added.
- Ambiguous matches go to Possible, never guessed as Confident.
