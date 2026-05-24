## Plan: Rename email + transfer all listings to Austyn

Got it — `chris@allagentconnect.com` is your admin account and will be left fully intact (auth row, profile, roles, everything). Only its **listings** move off it.

### Single atomic migration

1. **Rename `tuite.chris11@gmail.com` → `agentaustyn@gmail.com`** (id `ea18faa4-700f-4143-8c8e-436795a623af`)
   - `auth.users.email` → `agentaustyn@gmail.com`
   - `auth.users.email_confirmed_at` → `now()` (so Austyn can log in after a password reset; bypasses the confirm-email flow)
   - Clear pending `email_change*` fields
   - `public.profiles.email` → `agentaustyn@gmail.com`, `first_name` → `Austyn`, `last_name` cleared
   - `public.agent_profiles` (if row exists): same email + name update; leave `aac_id`, headshot, logo, bio, office fields untouched

2. **Transfer listings**
   - `UPDATE public.listings SET agent_id = 'ea18faa4-…-a623af' WHERE agent_id = '1fc50da1-…-e24dc5ed8c'` (the 4 listings currently on `chris@allagentconnect.com`)
   - Add a `listing_audit_log` entry per listing for traceability

### Explicitly NOT touched
- `chris@allagentconnect.com` auth user, profile, **`user_roles` (admin role preserved)**, agent_profile, settings — all left exactly as-is
- That account simply ends up with 0 listings; admin access, login, and everything else continue to work normally
- Branding/avatars/bio/license on Austyn's profile (edit later in UI)
- Buyer relationships, hot sheets, conversations, CRM clients

### End state
- `agentaustyn@gmail.com` → 7 listings (3 original + 4 transferred), must use "Forgot password" on first login
- `chris@allagentconnect.com` → 0 listings, still admin, fully functional

### One question before I run it
What surname should Austyn's profile have? Options: leave `last_name` blank, or give me a specific last name.