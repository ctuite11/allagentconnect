import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  buildCommsCenterGuideEmailHtml,
  COMMS_CENTER_GUIDE_SUBJECT,
} from "../_shared/buildCommsCenterGuideEmailHtml.ts";
import { getVerifiedAgentAudience } from "../_shared/verifiedAgentAudience.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CTA_URL = "https://allagentconnect.com/communications";

interface BroadcastRequest {
  /** When true, do not enqueue — just return audience count. */
  dryRun?: boolean;
  /**
   * When set, send only to this single email address (admin's own inbox
   * for preview). Bypasses the audience helper entirely.
   */
  testTo?: string;
  /** Optional first name to personalize the greeting in the test send. */
  testFirstName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const log = (step: string, extra: Record<string, unknown> = {}) => {
    try {
      console.log(`[send-comms-guide-broadcast] ${step}`, JSON.stringify(extra));
    } catch {
      console.log(`[send-comms-guide-broadcast] ${step}`);
    }
  };
  const logErr = (step: string, e: unknown) => {
    const anyE = e as any;
    console.error(`[send-comms-guide-broadcast] FAIL ${step}`, {
      message: anyE?.message ?? String(e),
      code: anyE?.code,
      details: anyE?.details,
      hint: anyE?.hint,
      status: anyE?.status,
    });
  };
  const failJson = (step: string, e: unknown, status = 500) => {
    const anyE = e as any;
    logErr(step, e);
    return new Response(
      JSON.stringify({
        error: anyE?.message ?? String(e),
        step,
        code: anyE?.code,
        details: anyE?.details,
        hint: anyE?.hint,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  try {
    log("invoke", { method: req.method });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    log("env", {
      hasUrl: !!supabaseUrl,
      hasService: !!serviceKey,
      hasAnon: !!anonKey,
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log("auth.missing_header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      logErr("auth.getUser", userErr ?? new Error("no user"));
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    log("auth.ok", { userId: user.id });

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) {
      return failJson("has_role", roleErr);
    }
    if (!isAdmin) {
      log("has_role.denied", { userId: user.id });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log("has_role.ok");

    let body: BroadcastRequest = {};
    try {
      body = (await req.json()) as BroadcastRequest;
    } catch (e) {
      logErr("parse_body", e);
      body = {};
    }
    log("body", {
      hasTestTo: typeof body.testTo === "string",
      dryRun: body.dryRun === true,
    });
    const admin = createClient(supabaseUrl, serviceKey);

    // ---------- Test send path ---------------------------------------------
    if (body.testTo && typeof body.testTo === "string") {
      const to = body.testTo.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return new Response(JSON.stringify({ error: "Invalid testTo" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let html: string;
      try {
        html = buildCommsCenterGuideEmailHtml({
          agentFirstName: body.testFirstName ?? null,
          ctaUrl: CTA_URL,
        });
        log("build_html.ok", { bytes: html.length });
      } catch (e) {
        return failJson("build_html", e);
      }

      const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 12);
      const { error: insertErr } = await admin.from("email_jobs").insert({
        idempotency_key: `comms-guide-test:${to}:${stamp}`,
        payload: {
          provider: "resend",
          template: "comms_center_guide",
          category: "marketing",
          to,
          subject: `[TEST] ${COMMS_CENTER_GUIDE_SUBJECT}`,
          html,
          metadata: { audience: "admin_test", triggered_by: user.id },
        },
      });
      if (insertErr) return failJson("email_jobs.insert.test", insertErr);
      log("email_jobs.insert.test.ok");

      // Kick the queue immediately so the test lands fast.
      const kick = await admin.functions
        .invoke("kick-email-queue", { body: {} })
        .catch((e) => ({ error: e }));
      if ((kick as any)?.error) logErr("kick-email-queue", (kick as any).error);
      else log("kick-email-queue.ok");

      return new Response(
        JSON.stringify({ ok: true, mode: "test", to, enqueued: 1 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- Full audience path -----------------------------------------
    let audience;
    try {
      audience = await getVerifiedAgentAudience(admin);
      log("audience.ok", { total: audience.length });
    } catch (e) {
      return failJson("audience", e);
    }
    const eligible = audience.filter((a) => a.has_email);

    if (body.dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "dryRun",
          audience_total: audience.length,
          eligible_recipients: eligible.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Broadcast key so a re-run within the same UTC day cannot double-send.
    const broadcastDay = new Date().toISOString().slice(0, 10);

    const jobs = eligible.map((a) => ({
      idempotency_key: `comms-guide:${broadcastDay}:${a.agent_id}`,
      payload: {
        provider: "resend",
        template: "comms_center_guide",
        category: "marketing",
        to: a.email,
        subject: COMMS_CENTER_GUIDE_SUBJECT,
        html: buildCommsCenterGuideEmailHtml({
          agentFirstName: a.first_name,
          ctaUrl: CTA_URL,
        }),
        metadata: {
          audience: "verified_agent",
          broadcast: "comms_center_guide",
          broadcast_day: broadcastDay,
          agent_id: a.agent_id,
          triggered_by: user.id,
        },
      },
    }));

    let enqueued = 0;
    if (jobs.length) {
      // Chunk inserts to avoid oversize payloads (HTML is ~15KB * N).
      const CHUNK = 25;
      for (let i = 0; i < jobs.length; i += CHUNK) {
        const slice = jobs.slice(i, i + CHUNK);
        const { error, count } = await admin
          .from("email_jobs")
          .insert(slice, { count: "exact" });
        if (error) {
          // ignore duplicate-idempotency-key rows (rerun same day)
          if (!/duplicate|unique/i.test(error.message)) throw error;
        } else {
          enqueued += count ?? slice.length;
        }
      }
    }

    await admin.functions
      .invoke("kick-email-queue", { body: {} })
      .catch(() => undefined);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "broadcast",
        eligible_recipients: eligible.length,
        enqueued,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-comms-guide-broadcast] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});