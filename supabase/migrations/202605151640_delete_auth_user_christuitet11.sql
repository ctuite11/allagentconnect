-- Fully delete orphaned auth user christuitet11@gmail.com so they can re-register
DELETE FROM auth.users WHERE id = '61c086a7-9f68-4d9f-ac1d-b03a9ca20793';
