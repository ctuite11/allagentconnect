import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  defaultCommsActionUrl,
  digestWindowsOpen,
  type DigestCadence,
} from "../_shared/commsDigest.ts";
import { assertCommsEnqueueAllowed } from "../_shared/emailStreams.ts";
import { assertPrivilegedEmailProducerAuthority } from "../_shared/emailFunctionAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DigestItem = {
  id: string;
  agent_id: string;
  cadence: DigestCadence;
  source_type: string;
  source_id: string;
  category: string | null;
  title: string;
  item_html: string;
  action_url: string | null;
  created_at: string;
};

const MAX_AGENTS_PER_RUN = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await assertPrivilegedEmailProducerAuthority(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const pauseGate = assertCommsEnqueueAllowed();
    if (pauseGate.paused) {
      return new Response(
        JSON.stringify({
          paused: true,
          switch: pauseGate.switch,
          reason: pauseGate.reason,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch {
      // empty body from cron is fine
    }

    const windows = digestWindowsOpen(new Date());
    const report: Record<string, unknown> = {
      et_weekday: windows.etWeekday,
      et_hour: windows.etHour,
      daily_window: windows.daily,
      weekly_window: windows.weekly,
      force,
      daily: { processed: 0, sent: 0, failed: 0, skipped: 0 },
      weekly: { processed: 0, sent: 0, failed: 0, skipped: 0 },
    };

    if (force || windows.daily) {
      report.daily = await processCadence(supabase, "daily", windows.dailyPeriodKey);
    }
    if (force || windows.weekly) {
      report.weekly = await processCadence(supabase, "weekly", windows.weeklyPeriodKey);
    }

    console.log("[process-comms-digests]", JSON.stringify(report));
    return new Response(JSON.stringify({ success: true, ...report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-comms-digests] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processCadence(
  supabase: ReturnType<typeof createClient>,
  cadence: DigestCadence,
  periodKey: string,
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  // Agents with pending items for this cadence
  const { data: pendingRows, error: pendingErr } = await supabase
    .from("comms_digest_items")
    .select("agent_id")
    .eq("cadence", cadence)
    .is("digest_send_id", null)
    .limit(5000);

  if (pendingErr) throw pendingErr;

  const agentIds = Array.from(
    new Set((pendingRows || []).map((r: { agent_id: string }) => r.agent_id)),
  ).slice(0, MAX_AGENTS_PER_RUN);

  for (const agentId of agentIds) {
    stats.processed++;
    const result = await processAgentDigest(supabase, agentId, cadence, periodKey);
    if (result === "sent") stats.sent++;
    else if (result === "failed") stats.failed++;
    else stats.skipped++;
  }

  return stats;
}

async function processAgentDigest(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  cadence: DigestCadence,
  periodKey: string,
): Promise<"sent" | "failed" | "skipped"> {
  // Already successfully sent this period?
  const { data: existing } = await supabase
    .from("comms_digest_sends")
    .select("id, status, attempts, max_attempts, email_job_id")
    .eq("agent_id", agentId)
    .eq("cadence", cadence)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (existing?.status === "sent") return "skipped";
  if (
    existing &&
    existing.status === "failed" &&
    (existing.attempts ?? 0) >= (existing.max_attempts ?? 5)
  ) {
    return "skipped";
  }

  // Claim / create processing row
  let sendId: string;
  if (!existing) {
    const { data: inserted, error: insertErr } = await supabase
      .from("comms_digest_sends")
      .insert({
        agent_id: agentId,
        cadence,
        period_key: periodKey,
        status: "processing",
        attempts: 1,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Race: another worker claimed it
      if (insertErr.code === "23505") return "skipped";
      throw insertErr;
    }
    sendId = inserted.id as string;
  } else {
    sendId = existing.id as string;
    const { error: updErr } = await supabase
      .from("comms_digest_sends")
      .update({
        status: "processing",
        attempts: (existing.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", sendId)
      .neq("status", "sent");
    if (updErr) throw updErr;
  }

  // Load pending items (only mark after email_job created)
  const { data: items, error: itemsErr } = await supabase
    .from("comms_digest_items")
    .select(
      "id, agent_id, cadence, source_type, source_id, category, title, item_html, action_url, created_at",
    )
    .eq("agent_id", agentId)
    .eq("cadence", cadence)
    .is("digest_send_id", null)
    .order("created_at", { ascending: true });

  if (itemsErr) {
    await markSendFailed(supabase, sendId, itemsErr.message);
    return "failed";
  }

  const digestItems = (items || []) as DigestItem[];
  if (digestItems.length === 0) {
    // Nothing to send — delete orphan processing row so a later period can run cleanly
    await supabase.from("comms_digest_sends").delete().eq("id", sendId).eq("status", "processing");
    return "skipped";
  }

  const { data: profile, error: profileErr } = await supabase
    .from("agent_profiles")
    .select("id, first_name, email")
    .eq("id", agentId)
    .maybeSingle();

  if (profileErr || !profile?.email) {
    await markSendFailed(supabase, sendId, profileErr?.message || "missing agent email");
    return "failed";
  }

  const agentName = (profile.first_name as string) || "Agent";
  const subject =
    cadence === "daily"
      ? `Your daily Communications Center digest (${digestItems.length} update${digestItems.length === 1 ? "" : "s"})`
      : `Your weekly Communications Center digest (${digestItems.length} update${digestItems.length === 1 ? "" : "s"})`;

  const contentHtml = buildDigestHtml(cadence, agentName, digestItems);
  const idempotencyKey = `comms-digest:${cadence}:${periodKey}:${agentId}`;

  const { data: jobRows, error: jobErr } = await supabase
    .from("email_jobs")
    .insert({
      stream: "communications",
      idempotency_key: idempotencyKey,
      payload: {
        provider: "resend",
        template: "comms-digest",
        to: profile.email,
        subject,
        metadata: {
          audience: "agent",
          cadence,
          period_key: periodKey,
          agent_id: agentId,
          digest_send_id: sendId,
          item_count: digestItems.length,
        },
        variables: {
          agentName,
          cadence,
          periodKey,
          itemCount: digestItems.length,
          contentHtml,
          ctaUrl: defaultCommsActionUrl(),
        },
      },
    })
    .select("id")
    .maybeSingle();

  if (jobErr) {
    // Unique conflict: job already created — treat as success and attach items
    if (jobErr.code === "23505") {
      const { data: existingJob } = await supabase
        .from("email_jobs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingJob?.id) {
        await finalizeSend(supabase, sendId, existingJob.id, digestItems.map((i) => i.id));
        return "sent";
      }
    }
    await markSendFailed(supabase, sendId, jobErr.message);
    return "failed";
  }

  const jobId = jobRows?.id as string | undefined;
  if (!jobId) {
    await markSendFailed(supabase, sendId, "email_jobs insert returned no id");
    return "failed";
  }

  await finalizeSend(
    supabase,
    sendId,
    jobId,
    digestItems.map((i) => i.id),
  );
  return "sent";
}

async function finalizeSend(
  supabase: ReturnType<typeof createClient>,
  sendId: string,
  emailJobId: string,
  itemIds: string[],
) {
  // Mark items only after email_job exists (requirement 9).
  if (itemIds.length) {
    const { error: itemErr } = await supabase
      .from("comms_digest_items")
      .update({ digest_send_id: sendId })
      .in("id", itemIds)
      .is("digest_send_id", null);
    if (itemErr) throw itemErr;
  }

  const { error: sendErr } = await supabase
    .from("comms_digest_sends")
    .update({
      status: "sent",
      email_job_id: emailJobId,
      item_count: itemIds.length,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", sendId);

  if (sendErr) throw sendErr;
}

async function markSendFailed(
  supabase: ReturnType<typeof createClient>,
  sendId: string,
  message: string,
) {
  await supabase
    .from("comms_digest_sends")
    .update({
      status: "failed",
      last_error: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sendId);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDigestHtml(
  cadence: DigestCadence,
  agentName: string,
  items: DigestItem[],
): string {
  const label = cadence === "daily" ? "daily" : "weekly";
  const byCategory = new Map<string, DigestItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || "Communications";
    const list = byCategory.get(key) || [];
    list.push(item);
    byCategory.set(key, list);
  }

  const sections: string[] = [];
  for (const [category, group] of byCategory) {
    const cards = group
      .map((item) => {
        const when = new Date(item.created_at).toLocaleString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        return `
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 12px;background:#ffffff;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(category)}</p>
            <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(item.title)}</p>
            <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">${escapeHtml(when)} ET</p>
            <div style="font-size:14px;color:#334155;line-height:1.5;">${item.item_html || ""}</div>
          </div>`;
      })
      .join("");

    sections.push(`
      <div style="margin:0 0 24px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">
          ${escapeHtml(category)} (${group.length})
        </h3>
        ${cards}
      </div>`);
  }

  return `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(agentName)},</p>
    <p style="margin:0 0 20px;">
      Here is your ${label} Communications Center digest with
      <strong>${items.length}</strong> update${items.length === 1 ? "" : "s"} matching your preferences.
    </p>
    ${sections.join("")}
    <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
      Open Communications Center to view details and respond.
    </p>
  `;
}
