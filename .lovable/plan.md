# Add 34 new agent emails to the "not in database" spreadsheet

## Goal
Append the 34 emails from the user's latest list to `/mnt/documents/aac-agents-not-in-database.xlsx` (or the email-matched workbook, as directed), keeping the existing format.

## Status check result
All 34 emails were checked against accounts, agent profiles, early-access leads, invites, and pending verifications — zero matches. All are new.

## Steps
1. Load the existing workbook (currently 669 agent entries).
2. Append the 34 new emails with name (blank if unknown), email, domain, and source columns matching existing format.
3. Deduplicate against existing entries.
4. Save the updated workbook to `/mnt/documents/` for download.
5. Report the new total.

## No changes
- No database writes, no emails sent, no app code changes.
