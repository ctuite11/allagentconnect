

# Fix Client Hot Sheet Access

## Root Cause

The only UPDATE policy on `share_tokens` is `auth.uid() = agent_id`. When a client accepts an invite in `ClientInvitationSetup.tsx`, they try to set `accepted_by_user_id` on their token -- but since they are not the agent, the update silently fails. Every token stays `accepted_by_user_id = NULL`, so the dashboard can never find accepted tokens, and every hot sheet shows "Invite pending."

## Changes

### 1. Database Migration

Three policy changes, no drops needed (all permissive, Postgres ORs them):

**A) New UPDATE policy on `share_tokens`** -- lets clients mark tokens as accepted:

```sql
CREATE POLICY "Clients can accept tokens via email"
  ON public.share_tokens FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND lower(p.email) = lower(share_tokens.payload->>'client_email')
    )
  )
  WITH CHECK (accepted_by_user_id = auth.uid());
```

**B) Replace broken `hot_sheet_clients` SELECT policy** -- current one uses `client_id = auth.uid()` which fails because `client_id` is a CRM ID, not an auth ID:

```sql
DROP POLICY IF EXISTS "Clients can view their hot sheet links"
  ON public.hot_sheet_clients;

CREATE POLICY "Clients can view their hot sheet links"
  ON public.hot_sheet_clients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN profiles p ON lower(c.email) = lower(p.email)
      WHERE c.id = hot_sheet_clients.client_id
        AND p.id = auth.uid()
    )
  );
```

**C) Backfill older tokens** missing `client_email` in payload:

```sql
UPDATE share_tokens
SET payload = payload || jsonb_build_object('client_email', c.email)
FROM clients c
WHERE share_tokens.payload->>'client_id' = c.id::text
  AND share_tokens.payload->>'client_email' IS NULL
  AND share_tokens.payload->>'type' = 'client_hotsheet_invite';
```

### 2. ClientDashboard.tsx -- Remove broken filter

Remove `.eq("client_id", userId)` from the `hot_sheet_clients` query (around line 109). RLS now handles access control via the email join, so no application-level filter is needed.

Before:
```typescript
.from("hot_sheet_clients")
.select(`hot_sheet_id, hot_sheets(...)`)
.eq("client_id", userId);
```

After:
```typescript
.from("hot_sheet_clients")
.select(`hot_sheet_id, hot_sheets(...)`);
```

### 3. No other code changes needed

- `ClientInvitationSetup.tsx` -- the existing update code (lines 170-176) is correct; it just needs the RLS policy to allow it
- `App.tsx` -- route fixes already in place from prior changes
- `HotSheetReview.tsx` -- already writes `client_email` into token payloads

## Why no SELECT policy is needed on share_tokens

The "Anyone can validate tokens" policy has `USING(true)` -- every user can read every row. The dashboard query `.eq("accepted_by_user_id", userId)` will work once that column is populated by the UPDATE fix.

## Verification

1. Run migration
2. Accept a hot sheet invite as a new client
3. Query `share_tokens` -- `accepted_by_user_id` should now be set
4. Log in as that client, go to `/client/dashboard`
5. Hot sheets appear with working "View" buttons

