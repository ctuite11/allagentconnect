import { supabase } from "@/integrations/supabase/client";

export type DelegateMembership = {
  owner_user_id: string;
  display_name: string | null;
  role_label: string | null;
};

export type AccountDelegateRow = {
  member_id: string;
  delegate_user_id: string | null;
  invite_email: string;
  display_name: string | null;
  role_label: string | null;
  status: "invited" | "accepted" | "revoked";
  invited_at: string;
  accepted_at: string | null;
  last_active_at: string | null;
  is_online: boolean;
};

export type SetActiveOwnerContextResult = {
  owner_user_id: string;
  is_account_owner: boolean;
  owner_first_name: string | null;
  owner_last_name: string | null;
  expires_at: string;
};

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function inviteAccountDelegate(input: {
  invite_email: string;
  display_name?: string;
  role_label?: string;
}): Promise<{ ok: boolean; error?: string; member_id?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, error: "Not authenticated" };

  const { data, error } = await supabase.functions.invoke("invite-account-delegate", {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error || !data?.success) {
    return { ok: false, error: data?.error || error?.message || "Failed to send invite" };
  }

  return { ok: true, member_id: data.member_id };
}

export async function revokeAccountDelegate(
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, error: "Not authenticated" };

  const { data, error } = await supabase.functions.invoke("revoke-account-delegate", {
    body: { member_id: memberId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error || !data?.success) {
    return { ok: false, error: data?.error || error?.message || "Failed to revoke delegate" };
  }

  return { ok: true };
}

export async function acceptAccountDelegateInvite(
  token: string,
): Promise<{ ok: boolean; error?: string; owner_user_id?: string; owner_display_name?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, error: "Not authenticated" };

  const { data, error } = await supabase.functions.invoke("accept-account-delegate-invite", {
    body: { token },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error || !data?.success) {
    return { ok: false, error: data?.error || error?.message || "Failed to accept invite" };
  }

  return {
    ok: true,
    owner_user_id: data.owner_user_id,
    owner_display_name: data.owner_display_name,
  };
}

export async function setActiveOwnerContext(
  ownerUserId: string,
): Promise<{ ok: boolean; error?: string; data?: SetActiveOwnerContextResult }> {
  const { data, error } = await supabase.rpc("set_active_owner_context", {
    p_owner_user_id: ownerUserId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as SetActiveOwnerContextResult };
}

export async function clearActiveOwnerContext(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("clear_active_owner_context");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listAccountDelegatesForOwner(): Promise<AccountDelegateRow[]> {
  const { data, error } = await supabase.rpc("list_account_delegates_for_owner");
  if (error) {
    console.error("[listAccountDelegatesForOwner]", error.message);
    return [];
  }
  return (data ?? []) as AccountDelegateRow[];
}

export async function listDelegateMemberships(): Promise<DelegateMembership[]> {
  const { data, error } = await supabase.rpc("list_delegate_memberships");
  if (error) {
    console.error("[listDelegateMemberships]", error.message);
    return [];
  }
  return (data ?? []) as DelegateMembership[];
}
