import { supabase } from "@/integrations/supabase/client";

/**
 * LOCKED duplicate-email rule. The database function
 * `resolve_or_create_agent_contact` is the authority; browser checks are
 * convenience only. Hot Sheet attachment stays with the caller.
 */
export const OTHER_MEMBER_EMAIL_MESSAGE =
  "This email is associated with another member and cannot be added.";

export type ResolveContactResult =
  | { ok: true; contactId: string; created: boolean }
  | { ok: false; blocked: true; message: string };

export function isOtherMemberEmailError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? String(err ?? "");
  return msg.includes(OTHER_MEMBER_EMAIL_MESSAGE);
}

export async function resolveOrCreateAgentContact(input: {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
  clientType?: string | null;
  source?: string | null;
}): Promise<ResolveContactResult> {
  const { data, error } = await supabase.rpc("resolve_or_create_agent_contact", {
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName ?? "",
    p_phone: input.phone ?? null,
    p_client_type: input.clientType ?? null,
    p_source: input.source ?? null,
  } as never);
  if (error) {
    if (isOtherMemberEmailError(error)) {
      return { ok: false, blocked: true, message: OTHER_MEMBER_EMAIL_MESSAGE };
    }
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { contact_id: string; created: boolean }
    | undefined;
  if (!row?.contact_id) throw new Error("Contact could not be resolved");
  return { ok: true, contactId: row.contact_id, created: Boolean(row.created) };
}

