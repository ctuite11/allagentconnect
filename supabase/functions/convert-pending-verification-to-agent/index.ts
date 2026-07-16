import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findDeletedAgent } from "../_shared/checkDeletedAgent.ts";

/**
 * Phase 1 backend foundation. Admin-only conversion of a pending_verifications
 * row (or a raw email) into a verified agent record. NOT wired to any UI yet
 * and does NOT enqueue the License Verified email — that ships in Phase 3.
 *
 * Idempotent + collision-safe:
 *   - If the pending row is already status='verified' with converted_user_id,
 *     returns { code: 'already_converted' } and does nothing.
 *   - If an auth user for the email already exists (self-signup path like
 *     Jamie/Chrissy), reuses that user_id — no new auth user is created.
 *   - Otherwise creates a new auth user with email_confirm=true and no password.
 *   - Upserts agent_profiles, agent_settings (status=verified, verified_at now),
 *     and user_roles ('agent') so re-runs converge to the same state.
 *   - Updates pending row: status='verified', processed=true, processed_by,
 *     converted_user_id.
 *   - Writes an agent_verification_audit row.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ConvertBody {
  pendingVerificationId?: unknown;
  email?: unknown;
  /**
   * Phase 4 guardrail — set to true only after the admin has explicitly
   * confirmed the "previously deleted" dialog in the UI.
   */
  acknowledgeDeleted?: unknown;
  /**
   * @deprecated Ignored for status writes. Convert never marks non-activated
   * agents verified — admin-verify-agent owns that after license-verified enqueue.
   */
  deferVerifiedStatus?: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function findAuthUserByEmail(
  admin: any,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const target = email.toLowerCase();
  // supabase-js v2 has no email filter; scan page 1 (up to 1000 users).
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error("[convert] listUsers error:", error.message);
    return null;
  }
  const match = data?.users?.find((u: { email?: string | null }) => (u.email || "").toLowerCase() === target);
  return match ? { id: match.id, email: match.email || target } : null;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return json(401, { error: "Authorization required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Verify caller is an admin.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !caller) {
    return json(401, { error: "Invalid session" });
  }
  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (roleErr) {
    console.error("[convert] role check error:", roleErr.message);
    return json(500, { error: "Failed to verify admin role" });
  }
  if (isAdmin !== true) {
    return json(403, { error: "Admin access required" });
  }

  let body: ConvertBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const pendingId = typeof body.pendingVerificationId === "string" ? body.pendingVerificationId : null;
  const bodyEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const acknowledgeDeleted = body.acknowledgeDeleted === true;
  if (!pendingId && !bodyEmail) {
    return json(400, { error: "pendingVerificationId or email is required" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Load the pending row (by id or by email — most recent pending).
  let pending: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    company: string | null;
    license_state: string | null;
    license_number: string | null;
    license_last_name: string | null;
    status: string;
    converted_user_id: string | null;
  } | null = null;

  if (pendingId) {
    const { data, error } = await admin
      .from("pending_verifications")
      .select("id,email,first_name,last_name,phone,company,license_state,license_number,license_last_name,status,converted_user_id")
      .eq("id", pendingId)
      .maybeSingle();
    if (error) {
      console.error("[convert] load pending error:", error.message);
      return json(500, { error: "Failed to load pending verification" });
    }
    pending = data;
  } else if (bodyEmail) {
    const { data, error } = await admin
      .from("pending_verifications")
      .select("id,email,first_name,last_name,phone,company,license_state,license_number,license_last_name,status,converted_user_id")
      .ilike("email", bodyEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[convert] load pending by email error:", error.message);
      return json(500, { error: "Failed to load pending verification" });
    }
    pending = data;
  }

  if (!pending) {
    return json(404, { error: "Pending verification not found", code: "not_found" });
  }

  // 3. Idempotency: already converted?
  if (pending.status === "verified" && pending.converted_user_id) {
    return json(200, {
      ok: true,
      code: "already_converted",
      userId: pending.converted_user_id,
      pendingVerificationId: pending.id,
    });
  }

  const email = pending.email.toLowerCase();

  // 3b. Phase 4 guardrail — block silent recreation of a previously-deleted
  // agent. Admin must acknowledge in the UI and resubmit with
  // { acknowledgeDeleted: true } to bypass.
  if (!acknowledgeDeleted) {
    const deletedMatch = await findDeletedAgent(admin, email);
    if (deletedMatch) {
      console.warn(
        "[convert] blocked previously-deleted agent:",
        email,
        deletedMatch.id,
      );
      return json(409, {
        error:
          "This agent was previously deleted. Confirm in the UI to proceed.",
        code: "previously_deleted",
        match: deletedMatch,
      });
    }
  }

  // 4. Auth user handling: reuse existing or create fresh (no password).
  let userId: string;
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    userId = existing.id;
    console.log("[convert] reusing existing auth user for", email);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: pending.first_name,
        last_name: pending.last_name,
        created_via: "convert-pending-verification",
      },
    });
    if (createErr || !created?.user) {
      console.error("[convert] createUser error:", createErr?.message);
      return json(500, { error: "Failed to create auth user", code: "create_user_failed" });
    }
    userId = created.user.id;
  }

  // 5. Upsert agent_profiles. first_name/last_name are NOT NULL in the table.
  const profileRow: Record<string, unknown> = {
    id: userId,
    email,
    first_name: pending.first_name || "Agent",
    last_name: pending.last_name || "Pending",
  };
  if (pending.phone) profileRow.phone = pending.phone;
  if (pending.company) profileRow.company = pending.company;
  const { error: profileErr } = await admin
    .from("agent_profiles")
    .upsert(profileRow, { onConflict: "id" });
  if (profileErr) {
    console.error("[convert] upsert agent_profiles error:", profileErr.message);
    return json(500, { error: "Failed to upsert agent profile", code: "profile_failed" });
  }

  // 6. Upsert agent_settings. Include license fields from pending row.
  //    Never finalize verified here — admin-verify-agent owns verified +
  //    license-verified email enqueue. Leaving pending prevents orphaned
  //    verified/no-job accounts if a caller bypasses the canonical path.
  const nowIso = new Date().toISOString();
  const { data: existingSettings } = await admin
    .from("agent_settings")
    .select("account_activated_at, verified_at, agent_status")
    .eq("user_id", userId)
    .maybeSingle();
  const alreadyActivated = Boolean(existingSettings?.account_activated_at);
  const settingsRow: Record<string, unknown> = {
    user_id: userId,
    agent_status: alreadyActivated ? "verified" : "pending",
    verified_at: alreadyActivated
      ? existingSettings?.verified_at || nowIso
      : null,
    approval_email_sent: false,
  };
  if (pending.license_state) settingsRow.license_state = pending.license_state;
  if (pending.license_number) settingsRow.license_number = pending.license_number;
  if (pending.license_last_name) settingsRow.license_last_name = pending.license_last_name;
  const { error: settingsErr } = await admin
    .from("agent_settings")
    .upsert(settingsRow, { onConflict: "user_id" });
  if (settingsErr) {
    console.error("[convert] upsert agent_settings error:", settingsErr.message);
    return json(500, { error: "Failed to upsert agent settings", code: "settings_failed" });
  }

  // 7. Upsert user_roles ('agent').
  const { error: roleUpsertErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
  if (roleUpsertErr) {
    console.error("[convert] upsert user_roles error:", roleUpsertErr.message);
    return json(500, { error: "Failed to upsert user role", code: "role_failed" });
  }

  // 8. Update pending row.
  const { error: pendingErr } = await admin
    .from("pending_verifications")
    .update({
      status: "verified",
      processed: true,
      processed_at: nowIso,
      processed_by: caller.id,
      converted_user_id: userId,
    })
    .eq("id", pending.id);
  if (pendingErr) {
    console.error("[convert] update pending error:", pendingErr.message);
    return json(500, { error: "Failed to update pending verification", code: "pending_update_failed" });
  }

  // 9. Audit is owned by admin-verify-agent after license-verified enqueue.
  //    Convert never finalizes verified for non-activated agents.
  console.log(
    `[convert] account ready for ${userId} from pending ${pending.id} (status pending until admin-verify-agent)`,
  );

  return json(200, {
    ok: true,
    code: existing ? "converted_reused_user" : "converted_new_user",
    userId,
    pendingVerificationId: pending.id,
  });
}

Deno.serve(handleRequest);