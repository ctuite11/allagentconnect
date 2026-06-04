import { supabase } from "@/integrations/supabase/client";
import { resolveDisplayProfiles } from "@/lib/resolveDisplayProfiles";
import { fetchBuyerConnectedAgents } from "@/lib/resolveActiveBuyerAgentId";

export type BuyerMessageRecipient = {
  id: string;
  name: string;
  email: string;
  group: "agent" | "shared";
};

function formatDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
  email: string | null | undefined,
): string {
  const full = `${first ?? ""} ${last ?? ""}`.trim();
  if (full) return full;
  const e = (email ?? "").trim();
  if (e) return e.split("@")[0] || e;
  return "Unknown";
}

/**
 * People a buyer can start a DM with: their agent plus friends they invited (workspace).
 * Does not include general CRM contacts or agent-added hot sheet recipients.
 */
export async function fetchBuyerMessageRecipients(
  userId: string,
  userEmail?: string | null,
): Promise<BuyerMessageRecipient[]> {
  const peerIds = new Set<string>();

  const agents = await fetchBuyerConnectedAgents(userId, userEmail);
  for (const agent of agents) {
    if (agent.id && agent.id !== userId) peerIds.add(agent.id);
  }

  const workspaceIds = new Set<string>();

  const { data: memberRows } = await supabase
    .from("buyer_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  for (const row of memberRows ?? []) {
    if (row.workspace_id) workspaceIds.add(row.workspace_id);
  }

  const { data: ownedWorkspace } = await supabase
    .from("buyer_workspaces")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownedWorkspace?.id) workspaceIds.add(ownedWorkspace.id);

  const inviteNameByUserId = new Map<string, { name: string; email: string }>();

  if (workspaceIds.size > 0) {
    const wsList = [...workspaceIds];

    const { data: workspaces } = await supabase
      .from("buyer_workspaces")
      .select("id, owner_id")
      .in("id", wsList);

    for (const ws of workspaces ?? []) {
      if (ws.owner_id && ws.owner_id !== userId) peerIds.add(ws.owner_id);
    }

    const { data: members } = await supabase
      .from("buyer_workspace_members")
      .select("user_id")
      .in("workspace_id", wsList)
      .neq("user_id", userId);

    for (const member of members ?? []) {
      if (member.user_id) peerIds.add(member.user_id);
    }

    const { data: acceptedInvites } = await supabase
      .from("buyer_workspace_invites")
      .select(
        "accepted_by_user_id, buyer_user_id, buyer_email, buyer_first_name, buyer_last_name",
      )
      .in("workspace_id", wsList)
      .not("accepted_at", "is", null);

    for (const invite of acceptedInvites ?? []) {
      const authId = invite.accepted_by_user_id ?? invite.buyer_user_id;
      if (!authId || authId === userId) continue;
      peerIds.add(authId);
      const name = formatDisplayName(
        invite.buyer_first_name,
        invite.buyer_last_name,
        invite.buyer_email,
      );
      inviteNameByUserId.set(authId, { name, email: (invite.buyer_email ?? "").trim() });
    }
  }

  for (const agent of agents) {
    peerIds.delete(agent.id);
  }

  const profileMap = await resolveDisplayProfiles([...peerIds, ...agents.map((a) => a.id)]);

  const results: BuyerMessageRecipient[] = [];

  for (const agent of agents) {
    const profile = profileMap.get(agent.id);
    results.push({
      id: agent.id,
      name:
        formatDisplayName(
          profile?.first_name ?? agent.first_name,
          profile?.last_name ?? agent.last_name,
          profile?.email ?? agent.email,
        ) || "Your agent",
      email: (profile?.email ?? agent.email ?? "").trim(),
      group: "agent",
    });
  }

  for (const peerId of peerIds) {
    const profile = profileMap.get(peerId);
    const inviteMeta = inviteNameByUserId.get(peerId);
    results.push({
      id: peerId,
      name:
        formatDisplayName(profile?.first_name, profile?.last_name, profile?.email ?? inviteMeta?.email) ||
        inviteMeta?.name ||
        "Contact",
      email: (profile?.email ?? inviteMeta?.email ?? "").trim(),
      group: "shared",
    });
  }

  return results;
}
