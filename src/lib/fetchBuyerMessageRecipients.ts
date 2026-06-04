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

/** Hot sheets this buyer can access — same union as ClientDashboard / HotSheets. */
async function loadBuyerHotSheetIds(userId: string, userEmail?: string | null): Promise<string[]> {
  const ids = new Set<string>();
  const emailNorm = (userEmail ?? "").trim().toLowerCase();

  const { data: hscRows } = await supabase.from("hot_sheet_clients").select("hot_sheet_id");
  for (const row of hscRows ?? []) {
    const hid = (row as { hot_sheet_id?: string }).hot_sheet_id;
    if (hid) ids.add(hid);
  }

  const { data: tokenRows } = await supabase
    .from("share_tokens")
    .select("payload, accepted_at, accepted_by_user_id")
    .not("accepted_at", "is", null);

  for (const row of tokenRows ?? []) {
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {};
    if (payload.type !== "client_hotsheet_invite") continue;

    const hotSheetId = String(payload.hot_sheet_id ?? "");
    if (!hotSheetId) continue;

    const matchByUserId = row.accepted_by_user_id === userId;
    const tokenEmail = String(payload.client_email ?? "").toLowerCase().trim();
    const matchByEmail = Boolean(emailNorm && tokenEmail === emailNorm);
    if (matchByUserId || matchByEmail) ids.add(hotSheetId);
  }

  return [...ids];
}

/**
 * People a buyer can start a DM with: their agent(s) plus shared hot-sheet / workspace group.
 * Does not include general CRM contacts.
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

  const hotSheetIds = await loadBuyerHotSheetIds(userId, userEmail);
  if (hotSheetIds.length > 0) {
    const { data: tokenRows } = await supabase
      .from("share_tokens")
      .select("accepted_by_user_id, payload")
      .eq("payload->>type", "client_hotsheet_invite")
      .in("payload->>hot_sheet_id", hotSheetIds)
      .not("accepted_at", "is", null)
      .not("accepted_by_user_id", "is", null)
      .is("revoked_at", null);

    for (const row of tokenRows ?? []) {
      const authId = row.accepted_by_user_id;
      if (authId && authId !== userId) peerIds.add(authId);
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
        "Shared contact",
      email: (profile?.email ?? inviteMeta?.email ?? "").trim(),
      group: "shared",
    });
  }

  return results;
}
