

## Re-activate Buyer: tuite.chris@gmail.com

Run three SQL statements to restore this user's access:

1. **Restore buyer role** -- re-insert the `buyer` role into `user_roles` so login resolves to `/client/dashboard` instead of `/access-error`
2. **Clear deactivation flag** -- set `profiles.deactivated_at = NULL` so the account is no longer soft-deactivated
3. **Re-activate agent relationship** -- restore the active link to agent `1fc50da1-...` so the client dashboard shows their agent

### SQL to execute

```text
-- 1) Restore buyer role
INSERT INTO public.user_roles (user_id, role)
VALUES ('ce6abb12-674b-447b-b2b0-852502599545', 'buyer')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Clear deactivation flag
UPDATE public.profiles
SET deactivated_at = NULL
WHERE id = 'ce6abb12-674b-447b-b2b0-852502599545';

-- 3) Re-activate agent relationship
UPDATE public.client_agent_relationships
SET status = 'active', ended_at = NULL
WHERE client_id = 'ce6abb12-674b-447b-b2b0-852502599545'
  AND agent_id = '1fc50da1-2664-4931-8cab-64e24dc5ed8c';
```

### Expected result after execution

- User can log in and routes to `/client/dashboard`
- User appears in Admin > Registered Buyers
- Hot sheet and CRM data remain intact (no changes needed)
- Agent relationship restored with original agent

### Technical note

These are data-only operations (no schema changes). The `ON CONFLICT DO NOTHING` on the role insert is safe if the role already exists.

