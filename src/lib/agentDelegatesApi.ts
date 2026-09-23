import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, resolveEdgeFunctionErrorMessage } from "@/lib/invokeEdgeFunction";

export type AssistantScope =
  | { kind: "agent" }
  | { kind: "team"; teamId: string };

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
  team_id?: string | null;
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
      session?: {
        access_token: string;
        refresh_token: string;
      };
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

function scopeTeamId(scope?: AssistantScope): string | undefined {
  return scope?.kind === "team" ? scope.teamId : undefined;
}

async function invokeDelegateEdgeFunction<T extends Record<string, unknown>>(
  name: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string }> {
  try {
    const data = await invokeEdgeFunction<T>(name, body);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}

async function invokePublicDelegateEdgeFunction(
  name: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; code?: string }> {
  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const anonKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: Record<string, unknown> | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok || !data?.success) {
    const message = await resolveEdgeFunctionErrorMessage(
      response.ok ? null : { context: response, message: response.statusText },
      data,
    );
    return {
      ok: false,
      error: message,
      code: typeof data?.code === "string" ? data.code : undefined,
    };
  }

  return { ok: true, data };
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
  const result = await invokePublicDelegateEdgeFunction("accept-account-delegate-invite", {
    token: input.token.trim(),
    email: input.email.trim().toLowerCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    password: input.password,
    existingAccount: input.existingAccount === true,
  });

  if (result.ok !== true) {
    return { ok: false, error: result.error, code: result.code };
  }

  const sessionPayload = result.data.session;
  const session =
    sessionPayload &&
    typeof sessionPayload === "object" &&
    typeof (sessionPayload as { access_token?: unknown }).access_token === "string" &&
    typeof (sessionPayload as { refresh_token?: unknown }).refresh_token === "string"
      ? {
          access_token: (sessionPayload as { access_token: string }).access_token,
          refresh_token: (sessionPayload as { refresh_token: string }).refresh_token,
        }
      : undefined;

  return {
    ok: true,
    ownerUserId: String(result.data.owner_user_id),
    ownerDisplayName: String(result.data.owner_display_name || "the account owner"),
    alreadyAccepted: result.data.alreadyAccepted === true,
    session,
  };
}

export async function inviteAccountDelegate(input: {
  invite_email: string;
  member_id?: string;
  display_name?: string;
  role_label?: string;
  scope?: AssistantScope;
  update_only?: boolean;
}): Promise<{ ok: boolean; error?: string; member_id?: string; resent?: boolean }> {
  const teamId = scopeTeamId(input.scope);
  const result = await invokeDelegateEdgeFunction<{ member_id?: string; resent?: boolean }>(
    "invite-account-delegate",
    {
      invite_email: input.invite_email,
      ...(input.member_id ? { member_id: input.member_id } : {}),
      ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
      ...(input.role_label !== undefined ? { role_label: input.role_label } : {}),
      ...(teamId ? { team_id: teamId } : {}),
      ...(input.update_only ? { update_only: true } : {}),
    },
  );

  if (result.ok !== true) {
    return { ok: false, error: result.error };
  }

  return { ok: true, member_id: result.data.member_id, resent: result.data.resent === true };
}

export async function revokeAccountDelegate(
  memberId: string,
  scope?: AssistantScope,
): Promise<{ ok: boolean; error?: string }> {
  const teamId = scopeTeamId(scope);
  const result = await invokeDelegateEdgeFunction("revoke-account-delegate", {
    member_id: memberId,
    ...(teamId ? { team_id: teamId } : {}),
  });

  if (result.ok !== true) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export type DelegateInviteActivityRow = {
  id: string;
  action: "DELEGATE_INVITE_SENT" | "DELEGATE_INVITE_RESENT";
  created_at: string;
  record_id: string | null;
};

export function delegateInviteActivityLabel(action: DelegateInviteActivityRow["action"]): string {
  if (action === "DELEGATE_INVITE_RESENT") return "Invitation resent";
  return "Invitation sent";
}

export async function listDelegateInviteActivity(
  scope?: AssistantScope,
): Promise<DelegateInviteActivityRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Activity is audited under the acting user; for team scope we still show
  // the caller's recent invite actions (filtered client-side by loaded rows).
  void scope;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, record_id")
    .eq("user_id", user.id)
    .eq("table_name", "agent_account_members")
    .in("action", ["DELEGATE_INVITE_SENT", "DELEGATE_INVITE_RESENT"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[listDelegateInviteActivity]", error.message);
    return [];
  }

  return (data ?? []) as DelegateInviteActivityRow[];
}

export async function listAccountDelegatesForOwner(
  scope?: AssistantScope,
): Promise<AccountDelegateRow[]> {
  if (scope?.kind === "team") {
    const { data, error } = await supabase.rpc("list_account_delegates_for_team", {
      p_team_id: scope.teamId,
    });
    if (error) {
      console.error("[listAccountDelegatesForTeam]", error.message);
      return [];
    }
    return (data ?? []) as AccountDelegateRow[];
  }

  const { data, error } = await supabase.rpc("list_account_delegates_for_owner");
  if (error) {
    console.error("[listAccountDelegatesForOwner]", error.message);
    return [];
  }
  return (data ?? []) as AccountDelegateRow[];
}
