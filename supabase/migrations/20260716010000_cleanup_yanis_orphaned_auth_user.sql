-- One-time data cleanup: orphaned auth user for yanis@conceptre.com
-- Confirms BOTH id and email before delete (no schema changes).
-- Safe if already removed: DELETE affects 0 rows.

DELETE FROM auth.users
WHERE id = 'c9895cfa-2ffb-42b7-9b74-b1aeea5cafc6'
  AND lower(email) = lower('yanis@conceptre.com');
