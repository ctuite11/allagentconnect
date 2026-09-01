# Plan: Create downloadable spreadsheet of 132 new invitation emails

## Goal
Generate a clean Excel file containing only the 132 email addresses from the Facebook-group invite list that do **not** already exist in the AAC system.

## Source data
- Existing file: `/mnt/documents/aac-invite-emails.xlsx` (135 unique emails from 7 screenshots).
- Records to exclude (already in AAC):
  - Drake Cormier (`drake@drakecormier.com`) — verified agent
  - Linda Desaulniers (`lindad@tru2yourealty.com`) — has an account
  - Joshua Stephens (`jstephens@warrenre.com`) — verified early-access lead

## Steps
1. Load the `Emails` sheet from `/mnt/documents/aac-invite-emails.xlsx`.
2. Remove the 3 rows whose `Email` matches one of the above addresses.
3. Re-sort the remaining 132 rows alphabetically by `Email` for easy scanning.
4. Preserve columns: `Name`, `Email`, `Domain`, `Screenshot`.
5. Save the result to `/mnt/documents/aac-invite-emails-132-new.xlsx`.
6. Verify the output contains exactly 132 rows and zero duplicates.

## Output
A single `.xlsx` file ready for download at `/mnt/documents/aac-invite-emails-132-new.xlsx`.
