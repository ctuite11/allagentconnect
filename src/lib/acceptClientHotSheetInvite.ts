import { supabase } from "@/integrations/supabase/client";

export type AcceptClientHotSheetInviteInput = {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  existingAccount?: boolean;
};

export type AcceptClientHotSheetInviteResult =
  | {
      ok: true;
      userId: string;
      agentId: string;
      crmClientId: string | null;
      alreadyAccepted: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function acceptClientHotSheetInvite(
  input: AcceptClientHotSheetInviteInput,
): Promise<AcceptClientHotSheetInviteResult> {
  const { data, error } = await supabase.functions.invoke("accept-client-hot-sheet-invite", {
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
    userId: String(data.userId),
    agentId: String(data.agentId),
    crmClientId: data.crmClientId != null ? String(data.crmClientId) : null,
    alreadyAccepted: data.alreadyAccepted === true,
  };
}
