// @auth-classification: admin-only (caller must hold the admin role)
//
// One-click Developer approval.
//
// Reuses the agent onboarding primitives:
//   * auth.admin.createUser (no password, email pre-confirmed) — same as admin-create-user
//   * reissue_agent_activation_token → durable 7-day AAC activation token
//   * the same POST-redeemed /activate flow and recovery handoff
//
// Developer-specific: development_accounts + owner membership + developer role,
// and the developer_access_requests row transition to `approved`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { issueDeveloperSetupLink } from "../_shared/developerSetupLink.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Body {
  requestId?: string;
  accountName?: string;
  accountSlug?: string;
  notes?: string;
  /** Verification / dry-run switch: provision only, never queue an email. */
  sendEmail?: boolean;
  /** Explicit admin acknowledgement of a previous deletion tombstone. */
  acknowledgeDeleted?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ success: false, error: "Server misconfigured" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Admin gate ─────────────────────────────────────────────────────────
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: caller.user.id,
    _role: "admin",
  });
  if (roleErr || isAdmin !== true) return json({ success: false, error: "Forbidden" }, 403);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return json({ success: false, error: "requestId is required" }, 400);
  }
  const sendEmail = body.sendEmail !== false;

  // ── Load the request ───────────────────────────────────────────────────
  const { data: request, error: reqErr } = await admin
    .from("developer_access_requests")
    .select("id,email,first_name,company_name,status,provisioned_user_id,provisioned_account_id")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr) return json({ success: false, error: "Failed to load request" }, 500);
  if (!request) return json({ success: false, error: "Request not found", code: "not_found" }, 404);
  if (request.status === "declined") {
    return json({ success: false, error: "Request was declined", code: "declined" }, 409);
  }

  const email = String(request.email).trim().toLowerCase();

  // ── Resolve or create the auth user (idempotent) ───────────────────────
  let userId = request.provisioned_user_id ? String(request.provisioned_user_id) : "";
  let userExisted = Boolean(userId);

  if (!userId) {
    const lookup = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
    );
    const found = await lookup.json().catch(() => null);
    const match = (found?.users as Array<{ id: string; email: string }> | undefined)?.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (match?.id) {
      userId = match.id;
      userExisted = true;
    }
  }

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { intended_role: "developer", created_by_admin: true },
    });
    if (createErr || !created?.user?.id) {
      // Race: another approve created it a moment ago.
      if (createErr?.message?.includes("already been registered")) {
        return json({ success: false, error: "Retry approval", code: "user_race" }, 409);
      }
      console.error("[admin-approve-developer-request] createUser failed:", createErr?.message);
      return json({ success: false, error: "Failed to create developer user" }, 500);
    }
    userId = created.user.id;
    userExisted = false;

    // The generic signup trigger seeds every new auth user as an agent.
    // A Developer account is not an agent — strip the seeded agent artifacts
    // for this freshly created user only. Existing users are never touched.
    await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "agent");
    await admin.from("agent_settings").delete().eq("user_id", userId);
  }

  // ── Provision account + membership + role + request status (idempotent) ─
  const { data: provision, error: provErr } = await admin.rpc(
    "admin_provision_developer_access",
    {
      _request_id: requestId,
      _owner_user_id: userId,
      _account_name: body.accountName?.trim() || null,
      _account_slug: body.accountSlug?.trim() || null,
      _notes: body.notes?.trim() || null,
      _reviewer_id: caller.user.id,
    },
  );

  if (provErr) {
    console.error("[admin-approve-developer-request] provisioning failed:", provErr.message);
    return json({ success: false, error: "Failed to provision developer account" }, 500);
  }

  const result = (provision ?? {}) as { status?: string; account_id?: string };
  const accountId = result.account_id ?? null;
  const alreadyApproved = result.status === "already_approved";

  if (!sendEmail) {
    return json({
      success: true,
      status: alreadyApproved ? "already_approved" : "approved",
      requestId,
      userId,
      accountId,
      userExisted,
      email: { status: "skipped" },
    });
  }

  // ── Setup / activation email (same durable token as agents) ────────────
  // Provisioning above already succeeded and is idempotent. The email is a
  // SEPARATE outcome: a failure here must never roll back or re-run
  // provisioning — it is reported as a partial success so the admin can use
  // Send Setup Link from the Developer Approvals table.
  const issued = await issueDeveloperSetupLink({
    admin,
    supabaseUrl: SUPABASE_URL,
    serviceKey: SERVICE_KEY,
    secret: Deno.env.get("ACTIVATION_TOKEN_SECRET"),
    userId,
    email,
    firstName: request.first_name ?? null,
    acknowledgeDeleted: body.acknowledgeDeleted === true,
  });

  const approvalEnvelope = {
    success: true,
    approved: true,
    status: alreadyApproved ? "already_approved" : "approved",
    requestId,
    userId,
    accountId,
    userExisted,
  };

  if (issued.status === "previously_deleted") {
    return json({
      ...approvalEnvelope,
      email: { status: "previously_deleted", reason: issued.reason, match: issued.match },
    });
  }

  if (issued.status === "failed") {
    console.error("[admin-approve-developer-request] setup email failed:", issued.reason);
    return json({ ...approvalEnvelope, email: { status: "failed", reason: issued.reason } });
  }

  return json({
    ...approvalEnvelope,
    email: { status: issued.status, jobId: issued.jobId },
  });
});
