/**
 * One-time "Don't miss opportunities" agent activation campaign.
 *
 * Modes (explicit, fail-closed — default is dryRun):
 *   { mode: "dry_run" }                      -> counts + sample, enqueues nothing
 *   { mode: "test", to: "admin@..." }        -> exactly ONE job to ONE address
 *   { mode: "send", confirm: "SEND" }        -> full eligible audience, one job each
 *
 * Idempotency: `agent-activation-nudge-<lowercased email>` — fixed, no date
 * component, so the campaign can never double-send to the same address.
 *
 * Auth: admin JWT required (has_role(uid,'admin')) OR the service-role key.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AGENT_ACTIVATION_NUDGE_SUBJECT,
  AGENT_ACTIVATION_NUDGE_TEMPLATE,
  buildAgentActivationNudgeEmailHtml,
} from "../_shared/buildAgentActivationNudgeEmailHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Mode = "dry_run" | "test" | "send";

interface Recipient {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function idempotencyKeyFor(email: string): string {
  return `agent-activation-nudge-${email.trim().toLowerCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const opSecret = Deno.env.get("NUDGE_CAMPAIGN_SECRET") ?? "";
    const providedSecret = req.headers.get("x-campaign-secret") ?? "";
    const secretOk = !!opSecret && providedSecret === opSecret;
    if (!bearer && !secretOk) return json({ error: "Unauthorized" }, 401);

    // Service-role key is accepted directly; otherwise require an admin JWT.
    if (!secretOk && bearer !== serviceKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) return json({ error: "Unauthorized" }, 401);
      const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: Mode;
      to?: string;
      confirm?: string;
      testKeySuffix?: string;
    };
    const mode: Mode = body.mode ?? "dry_run";
    if (!["dry_run", "test", "send"].includes(mode)) {
      return json({ error: "Invalid mode" }, 400);
    }
    if (mode === "send" && body.confirm !== "SEND") {
      return json(
        { error: 'Full send requires { confirm: "SEND" }' },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ---------------------------------------------------------------
    // Audience: verified + activated agents with ZERO active Hot Sheets,
    // minus global suppression (email_unsubscribes ∪ suppressed_emails).
    // Computed fresh on every call.
    // ---------------------------------------------------------------
    const { data: settings, error: settingsErr } = await admin
      .from("agent_settings")
      .select("user_id")
      .not("verified_at", "is", null)
      .not("account_activated_at", "is", null);
    if (settingsErr) throw settingsErr;

    const baseIds = Array.from(
      new Set((settings ?? []).map((r: any) => r.user_id).filter(Boolean)),
    );

    const { data: activeSheets, error: sheetsErr } = await admin
      .from("hot_sheets")
      .select("user_id")
      .eq("is_active", true);
    if (sheetsErr) throw sheetsErr;
    const withActiveSheet = new Set(
      (activeSheets ?? []).map((r: any) => r.user_id).filter(Boolean),
    );

    const zeroSheetIds = baseIds.filter((id) => !withActiveSheet.has(id));
    const removedForHotSheet = baseIds.length - zeroSheetIds.length;

    // Profile fields for delivery.
    const profiles: any[] = [];
    for (let i = 0; i < zeroSheetIds.length; i += 200) {
      const chunk = zeroSheetIds.slice(i, i + 200);
      const { data, error } = await admin
        .from("agent_profiles")
        .select("id, email, first_name, last_name")
        .in("id", chunk);
      if (error) throw error;
      profiles.push(...(data ?? []));
    }

    const candidates: Recipient[] = [];
    let noEmail = 0;
    for (const p of profiles) {
      const email = typeof p.email === "string" ? p.email.trim() : "";
      if (!email || !email.includes("@")) {
        noEmail++;
        continue;
      }
      candidates.push({
        user_id: p.id,
        email,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
      });
    }

    // Mandatory suppression check — cannot be bypassed by any mode.
    const lowered = candidates.map((c) => c.email.toLowerCase());
    const suppressed = new Set<string>();
    for (let i = 0; i < lowered.length; i += 200) {
      const chunk = lowered.slice(i, i + 200);
      const [unsubs, supp] = await Promise.all([
        admin.from("email_unsubscribes").select("email").in("email", chunk),
        admin.from("suppressed_emails").select("email").in("email", chunk),
      ]);
      for (const r of unsubs.data ?? []) suppressed.add(String(r.email).toLowerCase());
      for (const r of supp.data ?? []) suppressed.add(String(r.email).toLowerCase());
    }

    const eligible = candidates.filter(
      (c) => !suppressed.has(c.email.toLowerCase()),
    );
    const suppressedCount = candidates.length - eligible.length;

    const stats = {
      verified_activated_base: baseIds.length,
      removed_has_active_hot_sheet: removedForHotSheet,
      zero_active_hot_sheet: zeroSheetIds.length,
      no_email_address: noEmail,
      suppressed_or_unsubscribed: suppressedCount,
      final_eligible: eligible.length,
    };

    if (mode === "dry_run") {
      return json({
        success: true,
        mode,
        stats,
        sample: eligible.slice(0, 15).map((r) => ({
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
          email: r.email,
        })),
        email_jobs_created: 0,
        emails_sent: 0,
      });
    }

    // ---------------------------------------------------------------
    // Enqueue targets
    // ---------------------------------------------------------------
    let targets: Recipient[];
    if (mode === "test") {
      const to = (body.to ?? "").trim();
      if (!to || !to.includes("@")) {
        return json({ error: "test mode requires a valid { to } address" }, 400);
      }
      if (suppressed.has(to.toLowerCase())) {
        return json({ error: "Recipient is suppressed/unsubscribed" }, 400);
      }
      const match = eligible.find(
        (r) => r.email.toLowerCase() === to.toLowerCase(),
      );
      targets = [
        match ?? { user_id: "test", email: to, first_name: null, last_name: null },
      ];
    } else {
      targets = eligible;
    }

    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    for (const r of targets) {
      const html = buildAgentActivationNudgeEmailHtml({
        agentFirstName: r.first_name,
      });
      // Test mode only: allows re-testing a revised email to the same address.
      // Never applied to a full send — the campaign key stays one-per-address.
      const key =
        mode === "test" && body.testKeySuffix
          ? `${idempotencyKeyFor(r.email)}-${String(body.testKeySuffix).slice(0, 40)}`
          : idempotencyKeyFor(r.email);
      const { error } = await admin.from("email_jobs").insert({
        idempotency_key: key,
        payload: {
          provider: "resend",
          template: AGENT_ACTIVATION_NUDGE_TEMPLATE,
          to: r.email,
          subject: AGENT_ACTIVATION_NUDGE_SUBJECT,
          html,
          reply_to: "hello@allagentconnect.com",
        },
      });
      if (error) {
        // Duplicate idempotency key = already sent once; never a second send.
        results.push({ email: r.email, success: false, error: error.message });
      } else {
        results.push({ email: r.email, success: true });
      }
    }

    const queued = results.filter((r) => r.success).length;
    if (queued > 0) {
      void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch((err) =>
        console.warn("[send-agent-activation-nudge] kick failed:", err)
      );
    }

    return json({
      success: true,
      mode,
      stats,
      email_jobs_created: queued,
      skipped_or_duplicate: results.length - queued,
      results: mode === "test" ? results : results.filter((r) => !r.success),
    });
  } catch (err: any) {
    console.error("[send-agent-activation-nudge] error:", err);
    return json({ success: false, error: err?.message ?? "Unknown error" }, 500);
  }
});
