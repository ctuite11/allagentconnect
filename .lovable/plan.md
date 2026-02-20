

# Fix: End Relationship RLS Block + Add RPCs

## Root Cause
The `client_agent_relationships` table has **no UPDATE RLS policy**. When the client calls `.update({ status: 'inactive' })`, RLS silently blocks it -- the call returns zero affected rows, and the relationship stays `active` in the database.

## Plan

### 1. Create two SECURITY DEFINER RPCs (database migration)

**`end_client_relationship()`** -- called by client to end their own relationship:
- Uses `auth.uid()` as `client_id`
- Updates `client_agent_relationships` SET `status = 'inactive'`, `ended_at = now()` WHERE `client_id = auth.uid()` AND `status = 'active'`
- Returns row count; raises exception if zero rows affected

**`agent_end_client_relationship(p_client_id uuid)`** -- called by agent to end a specific client:
- Uses `auth.uid()` as `agent_id`
- Updates `client_agent_relationships` SET `status = 'inactive'`, `ended_at = now()` WHERE `agent_id = auth.uid()` AND `client_id = p_client_id` AND `status = 'active'`
- Returns row count; raises exception if zero rows affected

Both bypass RLS via SECURITY DEFINER, so no UPDATE policy is needed.

### 2. Update client-side handlers to call RPCs

**`src/pages/ClientDashboard.tsx`** (`handleEndRelationship`):
- Replace direct `.update()` call with `supabase.rpc('end_client_relationship')`
- On error, show `error.message` in toast
- On success, call `clearPrimaryAgentId()`, reset state, reload

**`src/pages/ClientAgentSettings.tsx`** (`handleEndRelationship`):
- Same change: replace `.update()` with `supabase.rpc('end_client_relationship')`
- Keep existing `clearPrimaryAgentId()` and state reset logic

### 3. No other changes needed

- `syncStickyFromDB()` already handles the "agent ended it server-side" case on next page load
- `ActiveAgentBanner` and `ListingAttribution` already use `syncStickyFromDB()`
- No new tables, no new UI components

## Technical Details

### Migration SQL

```text
-- Client ends their own relationship
CREATE OR REPLACE FUNCTION public.end_client_relationship()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = auth.uid() AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for user % to end.', auth.uid();
  END IF;

  RETURN rows_affected;
END;
$$;

-- Agent ends a specific client relationship
CREATE OR REPLACE FUNCTION public.agent_end_client_relationship(p_client_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE agent_id = auth.uid() AND client_id = p_client_id AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for agent % with client % to end.', auth.uid(), p_client_id;
  END IF;

  RETURN rows_affected;
END;
$$;
```

### Handler change pattern (both files)

Replace:
```text
const { data, error } = await supabase
  .from("client_agent_relationships")
  .update({ status: "inactive", ended_at: new Date().toISOString() })
  .eq("client_id", currentUserId)
  .eq("status", "active")
  .select("id, status, ended_at");
```

With:
```text
const { data, error } = await supabase.rpc('end_client_relationship');
if (error) throw error;
```

## Acceptance Criteria
- Client clicks "End Relationship" -- DB row becomes `inactive`, sticky clears immediately
- Agent calls `agent_end_client_relationship` -- DB row becomes `inactive`, client sticky clears on next page load via `syncStickyFromDB()`
- No silent failures: RPC raises exception if no active row found
- No UPDATE RLS policy needed (SECURITY DEFINER bypasses RLS)

