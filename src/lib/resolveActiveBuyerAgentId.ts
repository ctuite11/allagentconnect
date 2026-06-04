import { supabase } from "@/integrations/supabase/client";
import { getPrimaryAgentId } from "@/utils/agentTracking";

/**
 * Resolve the buyer's representing agent from DB truth, with invite-time cookie fallback.
 * Order: active relationship by auth uid → CRM email–linked pending/active row → primary_agent_id cache.
 */
export async function resolveActiveBuyerAgentId(
  userId: string,
  userEmail?: string | null,
): Promise<string | null> {
  const { data: directRows, error: directErr } = await supabase
    .from("client_agent_relationships")
    .select("agent_id")
    .eq("client_id", userId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (directErr) {
    console.warn("[resolveActiveBuyerAgentId] direct lookup failed:", directErr.message);
  } else if (directRows?.[0]?.agent_id) {
    return directRows[0].agent_id;
  }

  const email = (userEmail ?? "").trim();
  if (email) {
    // RLS policy "Clients can view CRM-linked relationships by email" scopes rows to this buyer.
    const { data: crmRows, error: crmErr } = await supabase
      .from("client_agent_relationships")
      .select("agent_id")
      .is("client_id", null)
      .in("status", ["active", "pending"])
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (crmErr) {
      console.warn("[resolveActiveBuyerAgentId] CRM-linked lookup failed:", crmErr.message);
    } else if (crmRows?.[0]?.agent_id) {
      return crmRows[0].agent_id;
    }
  }

  return getPrimaryAgentId();
}

export type BuyerConnectedAgent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

/**
 * All agents a buyer can message — direct auth-linked and CRM email–linked relationships.
 * Mirrors resolveActiveBuyerAgentId lookups but returns every connected agent, not just one.
 */
export async function fetchBuyerConnectedAgents(
  userId: string,
  userEmail?: string | null,
): Promise<BuyerConnectedAgent[]> {
  const agentIds = new Set<string>();

  const { data: directRows, error: directErr } = await supabase
    .from("client_agent_relationships")
    .select("agent_id")
    .eq("client_id", userId)
    .in("status", ["active", "pending"])
    .is("ended_at", null);

  if (directErr) {
    console.warn("[fetchBuyerConnectedAgents] direct lookup failed:", directErr.message);
  } else {
    for (const row of directRows ?? []) {
      if (row.agent_id) agentIds.add(row.agent_id);
    }
  }

  const email = (userEmail ?? "").trim();
  if (email) {
    // RLS policy "Clients can view CRM-linked relationships by email" scopes rows to this buyer.
    const { data: crmRows, error: crmErr } = await supabase
      .from("client_agent_relationships")
      .select("agent_id")
      .is("client_id", null)
      .in("status", ["active", "pending"])
      .is("ended_at", null);

    if (crmErr) {
      console.warn("[fetchBuyerConnectedAgents] CRM-linked lookup failed:", crmErr.message);
    } else {
      for (const row of crmRows ?? []) {
        if (row.agent_id) agentIds.add(row.agent_id);
      }
    }
  }

  if (agentIds.size === 0) return [];

  const { data: profiles, error: profileErr } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email")
    .in("id", [...agentIds]);

  if (profileErr) {
    console.warn("[fetchBuyerConnectedAgents] agent profiles failed:", profileErr.message);
    return [];
  }

  return profiles ?? [];
}
