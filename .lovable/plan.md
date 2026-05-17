## Goal
Delete every hot sheet except the one associated with `chris.tuite@compass.com`.

## Match
Only one hot sheet has `chris.tuite@compass.com` in `hot_sheet_clients`:

- **KEEP** — `48b197db-1c5a-451a-b223-3498988470a8` — "Boston Homes" (owner: chris@allagentconnect.com)

## Delete (5)
| id | name | owner |
|---|---|---|
| d57b7a3e-b26f-48f9-8f42-94b5f7741b77 | all towns | tuite.chris11@gmail.com |
| 03ca107b-b5a6-422e-93cb-c74ee8dd3330 | hhhhhhh | chris@allagentconnect.com |
| 86848563-881d-4400-a576-9423f48bc3a3 | seaport | chris@allagentconnect.com |
| 19b95c04-11c1-4323-84e5-61dc61b8a4df | all towns | chris@allagentconnect.com |
| 54863c9e-49ff-4037-9d0a-5df6736dd159 | Loachak | chris@allagentconnect.com |

## Execution
Run a single DELETE via the data tool. The `delete_hot_sheet_client_links_before_hot_sheet_delete` trigger removes `hot_sheet_clients` rows automatically; other dependent rows (`hot_sheet_sent_listings`, `hot_sheet_comments`, etc.) cascade or are independent.

```sql
DELETE FROM public.hot_sheets
WHERE id <> '48b197db-1c5a-451a-b223-3498988470a8';
```

If any FK constraint blocks the delete, I'll clean up dependent tables (`hot_sheet_sent_listings`, `hot_sheet_comments`, `hot_sheet_favorites`, `hot_sheet_notifications`, `hot_sheet_listing_status`, `hot_sheet_subscribers`) for those 5 ids first, then retry.

Confirm to proceed.
