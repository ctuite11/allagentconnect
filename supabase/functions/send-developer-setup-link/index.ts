// @auth-classification: admin-only (caller must hold the admin role)
//
// Recovery action for Admin -> Developer Approvals: issue (or re-issue) the
// durable 7-day Developer setup link for an approved developer request.
//
// This never touches provisioning: no auth user is created, no role or
// development account is changed, and the request row is left as-is.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SECRET = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Admin gate ─────────────────────────────────────────────────────────
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: caller, error: callerErr } = await admin.auth.getUser(bearer);
  if (callerErr || !caller?.user) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: caller.user.id,
    _role: "admin",
  });
  if (isAdmin !== true) return json({ success: false, error: "Forbidden" }, 403);

  let body: { requestId?: string; acknowledgeDeleted?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!UUID_RE.test(requestId)) {
    return json({ success: false, error: "requestId is required" }, 400);
  }

  const { data: request, error: reqErr } = await admin
    .from("developer_access_requests")
    .select("id,email,first_name,status,provisioned_user_id")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr) return json({ success: false, error: "Failed to load request" }, 500);
  if (!request) return json({ success: false, error: "Request not found" }, 404);
  if (request.status !== "approved" || !request.provisioned_user_id) {
    return json(
      { success: false, code: "not_provisioned", error: "Verify this developer first." },
      409,
    );
  }

  const result = await issueDeveloperSetupLink({
    admin,
    supabaseUrl: SUPABASE_URL,
    serviceKey: SERVICE_KEY,
    secret: SECRET,
    userId: String(request.provisioned_user_id),
    email: String(request.email).trim().toLowerCase(),
    firstName: request.first_name ?? null,
    acknowledgeDeleted: body.acknowledgeDeleted === true,
  });

  if (result.status === "previously_deleted") {
    return json({ success: false, code: "previously_deleted", error: result.reason, match: result.match }, 409);
  }
  if (result.status === "failed") {
    return json({ success: false, code: "issuance_failed", error: result.reason }, 422);
  }

  return json({
    success: true,
    status: result.status,
    requestId,
    jobId: result.jobId,
    tokenId: result.tokenId,
  });
});