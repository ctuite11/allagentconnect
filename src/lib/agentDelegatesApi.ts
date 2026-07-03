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

export type DelegateInvitePreview = {
  valid: boolean;
  error?: string;
  status?: string;
  already_accepted?: boolean;
  invite_email?: string;
  display_name?: string | null;
  role_label?: string | null;
  owner_user_id?: string;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  owner_company?: string | null;
  owner_headshot_url?: string | null;
  account_exists?: boolean;
  is_licensed_agent?: boolean;
  blocked?: boolean;
  blocked_message?: string | null;
};

export type SetupDelegateInviteInput = {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  existingAccount?: boolean;
};

export type SetupDelegateInviteResult =
  | {
      ok: true;
      ownerUserId: string;
      ownerDisplayName: string;
      alreadyAccepted?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function previewDelegateInvite(token: string): Promise<DelegateInvitePreview> {
  const { data, error } = await supabase.rpc("get_delegate_invite_preview", {
    p_token: token.trim(),
  });

  if (error) {
    console.error("[previewDelegateInvite]", error.message);
    return { valid: false, error: "invalid_token" };
  }

  return (data ?? { valid: false, error: "invalid_token" }) as DelegateInvitePreview;
}

export async function setupDelegateInvite(
  input: SetupDelegateInviteInput,
): Promise<SetupDelegateInviteResult> {
  const { data, error } = await supabase.functions.invoke("accept-account-delegate-invite", {
    body: {
      token: input.token.trim(),
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      password: input.password,
      existingAccount: input.existingAccount === true,
    },
  });

  if (error) {
    return { ok: false, error: error.message || "Failed to accept invitation" };
  }

  if (!data?.success) {
    return {
      ok: false,
      error: data?.error || "Failed to accept invitation",
      code: data?.code,
    };
  }

  return {
    ok: true,
    ownerUserId: String(data.owner_user_id),
    ownerDisplayName: String(data.owner_display_name || "the account owner"),
    alreadyAccepted: data.alreadyAccepted === true,
  };
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

export async function listAccountDelegatesForOwner(): Promise<AccountDelegateRow[]> {
  const { data, error } = await supabase.rpc("list_account_delegates_for_owner");
  if (error) {
    console.error("[listAccountDelegatesForOwner]", error.message);
    return [];
  }
  return (data ?? []) as AccountDelegateRow[];
}
