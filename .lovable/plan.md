## Fix: Only show verified agents in "Newest Verified Agents" row

Currently the hook queries `agent_profiles` ordered by created_at — that includes the 56 pending agents alongside the 8 verified ones.

### Change
**`src/components/success-hub/networkActivity/useNewestVerifiedAgents.ts`**

Join to `agent_settings` and filter `agent_status = 'verified'`, order by `verified_at desc` (fallback `created_at desc`).

```ts
supabase
  .from("agent_profiles")
  .select("id, first_name, last_name, company, headshot_url, office_city, office_state, agent_settings!inner(agent_status, verified_at)")
  .eq("agent_settings.agent_status", "verified")
  .order("verified_at", { foreignTable: "agent_settings", ascending: false })
  .limit(limit);
```

No UI/layout changes. Skeletons and click-through behavior remain.

### Verification
Confirm the row shows only the 8 verified agents, most recently verified first.
