import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  friendlyAdminRpcError,
  parseSubmitDeveloperAccessResponse,
  type SubmitDeveloperAccessOutcome,
} from "./developerAccessRequestForm";

export type { SubmitDeveloperAccessOutcome };
export {
  friendlyAdminRpcError,
  friendlyValidationMessages,
  parseSubmitDeveloperAccessResponse,
  validateDeveloperAccessForm,
} from "./developerAccessRequestForm";

export type DeveloperAccessRequestRow =
  Database["public"]["Tables"]["developer_access_requests"]["Row"];

export type DeveloperAccessRequestPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  website?: string;
  project_name?: string;
  market?: string;
  note?: string;
  source?: string;
};

export async function submitDeveloperAccessRequest(
  payload: DeveloperAccessRequestPayload,
): Promise<SubmitDeveloperAccessOutcome> {
  const body = {
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    company_name: payload.company_name.trim(),
    website: payload.website?.trim() || undefined,
    project_name: payload.project_name?.trim() || undefined,
    market: payload.market?.trim() || undefined,
    note: payload.note?.trim() || undefined,
    source: payload.source?.trim() || "developer-access",
  };

  try {
    const { data, error } = await supabase.functions.invoke("submit-developer-access-request", {
      body,
    });
    return parseSubmitDeveloperAccessResponse(data, error);
  } catch {
    return { kind: "failure" };
  }
}

/** Resolve an existing AAC profile id by email (admin SELECT on profiles). */
export async function findProfileUserIdByEmail(email: string): Promise<{
  userId: string | null;
  error: string | null;
}> {
  const trimmed = email.trim();
  if (!trimmed) return { userId: null, error: null };

  const { data: exact, error: exactErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", trimmed)
    .maybeSingle();
  if (exactErr) return { userId: null, error: friendlyAdminRpcError(exactErr.message) };
  if (exact?.id) return { userId: String(exact.id), error: null };

  const { data: loose, error: looseErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", trimmed.toLowerCase())
    .maybeSingle();
  if (looseErr) return { userId: null, error: friendlyAdminRpcError(looseErr.message) };
  return { userId: loose?.id ? String(loose.id) : null, error: null };
}

export async function fetchDeveloperAccessRequests(status: string = "pending"): Promise<{
  requests: DeveloperAccessRequestRow[];
  error: string | null;
}> {
  let query = supabase
    .from("developer_access_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return { requests: [], error: friendlyAdminRpcError(error.message) };
  return { requests: (data ?? []) as DeveloperAccessRequestRow[], error: null };
}

export async function declineDeveloperAccessRequest(input: {
  requestId: string;
  notes?: string;
}): Promise<{ request: DeveloperAccessRequestRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_decide_developer_access_request", {
    _request_id: input.requestId,
    _decision: "declined",
    _notes: input.notes?.trim() || undefined,
  });
  if (error) return { request: null, error: friendlyAdminRpcError(error.message) };
  return { request: (data as DeveloperAccessRequestRow) ?? null, error: null };
}

export async function approveDeveloperAccessRequest(input: {
  requestId: string;
  ownerUserId: string;
  accountName?: string;
  accountSlug?: string;
  notes?: string;
}): Promise<{ accountId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_approve_developer_access_request", {
    _request_id: input.requestId,
    _owner_user_id: input.ownerUserId,
    _account_name: input.accountName?.trim() || undefined,
    _account_slug: input.accountSlug?.trim() || undefined,
    _notes: input.notes?.trim() || undefined,
  });
  if (error) return { accountId: null, error: friendlyAdminRpcError(error.message) };
  return { accountId: data ? String(data) : null, error: null };
}
