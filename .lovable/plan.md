# Edit Agent: block editing for legacy accounts with no agent profile

## What changes
In the Admin Approvals "Edit Agent" panel only:

1. When the panel opens, it checks whether the account has an agent profile.
2. **Legacy account (no profile):**
   - The current details (name, email, phone, company, license) still show, but the fields are read-only.
   - A notice at the top says: "This is a legacy account without an agent profile. Profile editing is unavailable."
   - The Save button is disabled. Nothing is written, and no profile is created.
3. **Normal account (has a profile):** Edit works exactly as it does today.
4. **Safety net:** a save now confirms that the profile record was actually updated. If nothing was updated, it shows an error instead of "Agent updated successfully". The success message appears only after a confirmed save.

## Not changed
- Verification status, activation, roles, account data and Agent Network eligibility.
- Other Admin Approvals buttons, the admin list and the backend.
- No emails, invitations, notifications or admin actions during testing.

## Verification
- Type-check and build.
- Open Edit on a signed-in preview, without saving:
  - tuite.chris11@gmail.com shows the notice, read-only fields and a disabled Save.
  - A normal agent shows editable fields and an enabled Save.
- No saves on either account, so no data changes.

## Technical details
- The change is in one file, `src/components/admin/AgentEditDrawer.tsx`.
- On open, it runs `select id from agent_profiles where id = agent.id` and stores the result as `hasProfile` (loading, true or false). It doesn't rely on `profile_complete`, because that flag is also false for real agents whose profiles are incomplete.
- When `hasProfile === false`, the inputs are disabled, the notice is shown, and `handleSave` returns early, including the license upsert.
- The profile update gets `.select("id")`. If no row comes back, it throws "No agent profile was updated", so the success toast isn't shown.
- After the change goes live on GitHub `main`, the frontend auto-deploys as usual.
