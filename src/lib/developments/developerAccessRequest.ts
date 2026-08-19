import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
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

/** Row shape returned by the admin listing RPC (adds derived activation state). */
export type DeveloperApplicantRow = DeveloperAccessRequestRow & {
  activated_at: string | null;
};

/** Canonical UI status buckets derived from existing backend state. */
export type DeveloperApplicantStatus = "requested" | "verified" | "activated" | "rejected";

export function deriveDeveloperApplicantStatus(
  row: Pick<DeveloperApplicantRow, "status" | "activated_at">,
): DeveloperApplicantStatus {
  if (row.status === "declined") return "rejected";
  if (row.status === "approved") return row.activated_at ? "activated" : "verified";
  return "requested";
}

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

/**
 * Admin listing of every developer applicant, including derived activation state
 * (whether the provisioned user has redeemed their setup link).
 */
export async function fetchDeveloperApplicants(
  bucket: DeveloperApplicantStatus | "all" = "all",
): Promise<{ requests: DeveloperApplicantRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_list_developer_access_requests", {
    _status: "all",
  });
  if (error) return { requests: [], error: friendlyAdminRpcError(error.message) };
  const rows = (data ?? []) as DeveloperApplicantRow[];
  const filtered =
    bucket === "all" ? rows : rows.filter((r) => deriveDeveloperApplicantStatus(r) === bucket);
  return { requests: filtered, error: null };
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

/**
 * Verify (approve) a developer request.
 *
 * No pre-existing AAC account is required: the edge function creates the auth
 * user when needed, provisions the development account + `developer` role, and
 * (unless `sendEmail: false`) issues the 7-day setup/activation email.
 */
export async function approveDeveloperAccessRequest(input: {
  requestId: string;
  accountName?: string;
  accountSlug?: string;
  notes?: string;
  sendEmail?: boolean;
  /** Admin acknowledged a previously-deleted tombstone for this email. */
  acknowledgeDeleted?: boolean;
}): Promise<{
  accountId: string | null;
  userId: string | null;
  emailStatus: string | null;
  error: string | null;
  code?: string;
  deletedMatch?: unknown;
  /** True when the account was provisioned but the setup email leg failed. */
  provisioned?: boolean;
}> {
  try {
    const result = await invokeEdgeFunction<{
      accountId?: string | null;
      userId?: string | null;
      email?: { status?: string } | null;
    }>("admin-approve-developer-request", {
      requestId: input.requestId,
      accountName: input.accountName?.trim() || undefined,
      accountSlug: input.accountSlug?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      ...(input.sendEmail === false ? { sendEmail: false } : {}),
      ...(input.acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
    });
    return {
      accountId: result.accountId ? String(result.accountId) : null,
      userId: result.userId ? String(result.userId) : null,
      emailStatus: result.email?.status ?? null,
      error: null,
      provisioned: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve request.";
    const extra = err as { code?: string; match?: unknown; provisioned?: boolean };
    return {
      accountId: null,
      userId: null,
      emailStatus: null,
      error: message,
      code: extra?.code,
      deletedMatch: extra?.match,
      provisioned: extra?.provisioned === true,
    };
  }
}
