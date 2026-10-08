# Start fresh: delete all Hot Sheets for chris@allagentconnect.com

## What gets removed
- All 13 Hot Sheets on your account (newest "wdfwfwdf", oldest "boston" from June).
- Their 2 unsent saved batches ("wdfwfwdf", "Buyer one boston condo's").
- Their contact links, favorites, comments, statuses, shares, and sent-listing records.
- Any open (unaccepted) invitation links tied to these Hot Sheets, so you can send real first invitations again.

## What stays
- Your contacts in My Clients, including hidden "Hot Sheet only" contacts (only their link to the Hot Sheet is removed).
- Email history and the email queue. Nothing is sent, resent, or re-queued.
- Other agents' Hot Sheets, plus your buyer relationships and listings.
- The app itself and how it matches listings. No changes to either.

## Steps
1. Read only: list the exact Hot Sheet IDs (expect 13), open invite tokens, waiting batches, and every linked row. Record the email queue count. Stop if the count differs or any Hot Sheet belongs to another account.
2. Mark open invite tokens for these Hot Sheets as revoked/expired. If the table has no revoke field, delete them instead. Leave accepted invites alone.
3. Delete the waiting batches and linked child rows. Then delete the 13 Hot Sheets by their exact IDs, using the existing delete protections.
4. Check the result: zero Hot Sheets on your account, zero waiting batches, no open invites for those sheets. The email queue and contacts count should be unchanged.

## Technical notes
- Use explicit ID lists only, with no broad deletes. Run inside one transaction, and roll back if any count doesn't match.
- Respect the existing `delete_hot_sheet_client_links_before_hot_sheet_delete` trigger and `can_authenticated_user_delete_hot_sheet` rules.
