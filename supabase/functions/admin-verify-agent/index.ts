/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Canonical admin verify path:
 * 1) Ensure auth/agent rows exist (convert helpers with deferred verified status).
 * 2) If account_activated_at is null, enqueue license-verified (durable job id required).
 * 3) Only then set agent_status = verified.
 *
 * Never leaves a non-activated agent in verified without a license-verified email_jobs row.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type VerifyBody = {
  agentId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  licenseState?: string;
  licenseNumber?: string;
  company?: string;
  source?: string;
  pendingVerificationId?: string;
  isEarlyAccess?: boolean;
  earlyAccessId?: string;
  acknowledgeDeleted?: boolean;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { success: false, error: "Authorization required" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { success: false, error: "Unauthorized" });

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json(403, { success: false, error: "Forbidden" });

    const body = (await req.json().catch(() => ({}))) as VerifyBody;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return json(400, { success: false, error: "Valid email required" });
    }

    const acknowledgeDeleted = body.acknowledgeDeleted === true;
    const firstName = body.firstName?.trim() || undefined;
    const source = body.source || null;
    const isEarlyAccess = Boolean(body.isEarlyAccess);
    const pendingId =
      typeof body.pendingVerificationId === "string"
        ? body.pendingVerificationId
        : source === "pending_verification"
          ? body.agentId
          : undefined;

    // Invited (admin-created) agents activate via /agent-setup — never this path.
    if (body.agentId) {
      const { data: existingSettings } = await admin
        .from("agent_settings")
        .select("agent_status, account_activated_at")
        .eq("user_id", body.agentId)
        .maybeSingle();
      if (existingSettings?.agent_status === "invited") {
        return json(409, {
          success: false,
          error:
            "Admin-created invited agents must complete /agent-setup — do not use License Verified verify.",
          code: "invited_agent",
        });
      }
    }

    let userId: string | null = null;

    // Use fetch with the caller's Authorization for convert helpers (they require admin JWT).
    async function callConvert(path: string, payload: Record<string, unknown>) {
      const res = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
        method: "POST",
        headers: {
          Authorization: authHeader!,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }

    if (source === "pending_verification" || pendingId) {
      const { res, data } = await callConvert("convert-pending-verification-to-agent", {
        pendingVerificationId: pendingId,
        deferVerifiedStatus: true,
        ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
      });
      if (!res.ok || !data?.ok || !data?.userId) {
        return json(res.status >= 400 ? res.status : 500, {
          success: false,
          error: data?.error || "Failed to convert pending verification",
          code: data?.code,
        });
      }
      userId = data.userId as string;
    } else if (isEarlyAccess) {
      const earlyAccessId = body.earlyAccessId || body.agentId;
      const { res, data } = await callConvert("convert-early-access-to-account", {
        earlyAccessId,
        email,
        firstName: firstName || body.firstName || "Agent",
        lastName: body.lastName || "Agent",
        phone: body.phone,
        licenseState: body.licenseState,
        licenseNumber: body.licenseNumber,
        brokerage: body.company,
        skipEmail: true,
        deferVerifiedStatus: true,
        ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
      });
      if (!res.ok || data?.error || !data?.userId) {
        return json(res.status >= 400 ? res.status : 500, {
          success: false,
          error: data?.error || "Failed to convert early access account",
          code: data?.code,
        });
      }
      userId = data.userId as string;
    } else {
      userId = typeof body.agentId === "string" ? body.agentId : null;
      if (!userId) {
        return json(400, { success: false, error: "agentId required for existing agents" });
      }
    }

    const { data: settings } = await admin
      .from("agent_settings")
      .select("agent_status, account_activated_at, verified_at")
      .eq("user_id", userId)
      .maybeSingle();

    const alreadyActivated = Boolean(settings?.account_activated_at);
    const nowIso = new Date().toISOString();

    // Already activated → verify only, no activation email.
    if (alreadyActivated) {
      const { error: settingsError } = await admin.from("agent_settings").upsert(
        {
          user_id: userId,
          agent_status: "verified",
          verified_at: settings?.verified_at || nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );
      if (settingsError) {
        return json(500, { success: false, error: settingsError.message });
      }
      return json(200, {
        success: true,
        userId,
        emailSkipped: true,
        reason: "already_activated",
      });
    }

    // Enqueue License Verified BEFORE setting verified.
    const idempotencyKey = `license-verified:verify:${userId}`;
    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-license-verified-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        agentName: firstName,
        idempotencyKey,
        ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
      }),
    });
    const emailData = await emailRes.json().catch(() => ({}));

    if (emailRes.status === 409 && emailData?.code === "previously_deleted") {
      return json(409, {
        success: false,
        code: "previously_deleted",
        match: emailData.match ?? null,
        error: "Previously deleted agent — acknowledge required",
      });
    }

    const jobId =
      emailData?.results?.[0]?.jobId ||
      (Array.isArray(emailData?.results)
        ? emailData.results.find((r: { jobId?: string }) => r.jobId)?.jobId
        : null);
    const enqueueOk =
      emailRes.ok &&
      emailData?.success === true &&
      Number(emailData?.successCount || 0) > 0 &&
      Boolean(jobId);

    if (!enqueueOk) {
      return json(422, {
        success: false,
        error:
          emailData?.error ||
          emailData?.results?.[0]?.error ||
          "Activation email was not enqueued — agent was not marked verified",
        emailStatus: emailRes.status,
        emailData,
      });
    }

    // Only now mark verified.
    const { error: settingsError } = await admin.from("agent_settings").upsert(
      {
        user_id: userId,
        agent_status: "verified",
        verified_at: nowIso,
        updated_at: nowIso,
        approval_email_sent: false,
      },
      { onConflict: "user_id" },
    );
    if (settingsError) {
      return json(500, {
        success: false,
        error: `Email enqueued (${jobId}) but failed to mark verified: ${settingsError.message}`,
        jobId,
      });
    }

    if (isEarlyAccess) {
      const earlyAccessId = body.earlyAccessId || body.agentId;
      if (earlyAccessId) {
        await admin
          .from("agent_early_access")
          .update({
            status: "verified",
            verified_at: nowIso,
          })
          .eq("id", earlyAccessId);
      }
    }

    return json(200, {
      success: true,
      userId,
      jobId,
      emailSent: true,
    });
  } catch (err: any) {
    console.error("[admin-verify-agent] error:", err);
    return json(500, { success: false, error: err?.message ?? "Unknown error" });
  }
});
