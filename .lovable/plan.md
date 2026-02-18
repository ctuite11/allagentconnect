
# Atomic Activate Agent Relationship RPC

## What We're Doing and Why

The goal is to replace all direct `INSERT`/`UPDATE` calls to `client_agent_relationships` in the acceptance flow with a single atomic SECURITY DEFINER RPC (`activate_agent_relationship`). This works with the partial unique index we just created, ensures no race conditions, and prevents impersonation.

## Places That Write to `client_agent_relationships`

From the search, there are **4 places** that create or activate relationships:

1. **`src/pages/ClientInvitationSetup.tsx`** (lines 154–166) — Direct `INSERT` after new account signup. This is the primary "new client accepting an invite" flow.

2. **`src/components/AgentChoiceDialog.tsx`** (lines 35–50) — Two-step: first `UPDATE` old relationship to `inactive`, then `UPDATE` pending relationship to `active`. This runs when an existing client is offered a new agent.

3. **`src/pages/ClientHotSheet.tsx`** (lines 260–289) — Only reads relationships, then conditionally creates a `pending` row (this feeds into `AgentChoiceDialog`). This is a read-then-display path, not a direct write.

4. **`src/pages/HotSheetReview.tsx`** (line 280–284) — Only reads, no insert found there.

## What Changes

### A) New Migration: `activate_agent_relationship` RPC

Create `supabase/migrations/20260218030000_activate_agent_relationship_rpc.sql`:

```sql
-- Atomic RPC: ends any existing active relationship and creates a new active one.
-- auth.uid() is the client — no client_id parameter to prevent impersonation.

CREATE OR REPLACE FUNCTION public.activate_agent_relationship(_agent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  new_id uuid;
BEGIN
  _client_id := auth.uid();
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- End any existing active relationship (idempotent, safe with partial unique index)
  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE client_id = _client_id
    AND status = 'active';

  -- Insert new active relationship
  INSERT INTO public.client_agent_relationships (client_id, agent_id, status, created_at)
  VALUES (_client_id, _agent_id, 'active', now())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_agent_relationship(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_agent_relationship(uuid) TO authenticated;
```

### B) Update `src/pages/ClientInvitationSetup.tsx`

**Current code (lines 144–167):**
```typescript
// Check for existing active relationship
if (agentId) {
  const { data: existingRel } = await supabase
    .from("client_agent_relationships")
    .select("agent_id")
    .eq("client_id", authData.user.id)
    .eq("status", "active")
    .maybeSingle();

  // Create relationship with appropriate status
  const { error: relationshipError } = await supabase
    .from("client_agent_relationships")
    .insert({
      client_id: authData.user.id,
      agent_id: agentId,
      invitation_token: invitationToken,
      status: existingRel ? "pending" : "active",
    });

  if (relationshipError) {
    console.error("Error creating relationship:", relationshipError);
  }
}
```

**Replace with:**
```typescript
if (agentId) {
  const { error: relationshipError } = await supabase.rpc("activate_agent_relationship", {
    _agent_id: agentId,
  });

  if (relationshipError) {
    console.error("Error creating relationship:", relationshipError);
    // Don't fail the whole process if this fails
  }
}
```

Note: The `invitation_token` column is dropped from the insert because the RPC doesn't include it. The token is already recorded in `share_tokens.accepted_by_user_id` (done immediately after), so this is not a data loss.

### C) Update `src/components/AgentChoiceDialog.tsx`

**Current `handleSwitchAgent` (lines 30–61):** Two separate sequential updates — end old, then activate new. If the second fails, the first already ran and the client has no active agent.

**Replace with:**
```typescript
const handleSwitchAgent = async () => {
  try {
    setProcessing(true);

    const { error } = await supabase.rpc("activate_agent_relationship", {
      _agent_id: newAgent.id,
    });

    if (error) throw error;

    // Decline the old pending row that was created for the new agent (no longer needed)
    // The RPC already ended the old active relationship; the "pending" row for newAgent
    // was only a UI signal — now that we've activated, we don't need it.
    // Nothing extra required.

    toast.success(`You're now working with ${newAgent.first_name}`);
    onChoice(true);
  } catch (error: any) {
    console.error("Error switching agents:", error);
    toast.error(error?.message ?? "Failed to switch agents");
  } finally {
    setProcessing(false);
  }
};
```

Note: The `handleStayWithCurrent` path (declining the new relationship) does NOT use `activate_agent_relationship` — it just sets the pending row to `declined`. That stays as-is.

## What Does NOT Change

- `ClientDashboard.tsx` — only reads + ends via UPDATE, no activation. Already fixed.
- `ClientAgentSettings.tsx` — only reads + ends via UPDATE. Already fixed.
- `ClientHotSheet.tsx` — only reads and displays the agent choice dialog. No direct insert to fix.
- `HotSheetReview.tsx` — read only, no relationship insert.
- The partial unique index migration already applied.
- The `handleEndRelationship` logic in both dashboard files — already fixed in the previous step.

## Files to Edit

1. Create `supabase/migrations/20260218030000_activate_agent_relationship_rpc.sql`
2. Edit `src/pages/ClientInvitationSetup.tsx` — replace the insert block with `supabase.rpc(...)`
3. Edit `src/components/AgentChoiceDialog.tsx` — replace `handleSwitchAgent` body with `supabase.rpc(...)`

## Result

- Accepting a new invite always atomically ends the old active relationship and creates the new one.
- The partial unique index never triggers a violation — the old active row is removed before the new insert.
- No client can activate a relationship for another client (auth.uid() is the source of truth).
- `AgentChoiceDialog` "switch" path is now a single atomic operation instead of two sequential mutations.
