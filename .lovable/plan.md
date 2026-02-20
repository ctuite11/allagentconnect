

# Purge tuite.chris@gmail.com (8c6b2296-aec3-4cd8-9118-4d5f3308ed8f)

This user was deleted with the old incomplete flow. We need to clean up the 6 remaining orphaned records and then purge the Auth identity.

## Steps

1. **Run the new `admin_delete_consumer` RPC** via the admin UI or directly -- this will handle all DB cleanup in one transaction:
   - SET NULL on `share_tokens.accepted_by_user_id`
   - Delete `hot_sheet_clients` (2 rows)
   - Delete `client_agent_relationships` (if any)
   - Delete CRM `clients` record (`5391f493-...`)
   - Delete `favorites` (1 row)
   - Delete `user_roles` (buyer role)
   - Delete `profiles` row

2. **Call `delete-users` edge function** with `userIds: ["8c6b2296-aec3-4cd8-9118-4d5f3308ed8f"]` to purge the Auth identity.

3. **Verify** all tables return zero rows for this user ID and email.

## Technical Detail

Since the `admin_delete_consumer` RPC requires an authenticated admin caller (it checks `has_role(auth.uid(), 'admin')`), the cleanest path is to invoke it from the Admin Consumers page UI. Alternatively, I can run targeted SQL cleanup queries directly against the database tables, then call the edge function to purge Auth.

I will use direct SQL deletes for the DB records (since we cannot call the RPC without an authenticated admin session from code), then invoke the `delete-users` edge function to remove the Auth account.

