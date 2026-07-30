import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getFrontendUrl = (): string =>
  Deno.env.get("FRONTEND_URL") || "https://allagentconnect.com";

const STALE_DAYS = 30;

const STATUS_LABEL: Record<string, string> = {
  active: "On MLS",
  off_market: "Off Market",
};

const ELIGIBLE_STATUSES = ["active", "off_market"] as const;

function daysBetween(then: string | Date, now: Date): number {
  const t = typeof then === "string" ? new Date(then) : then;
  return Math.floor((now.getTime() - t.getTime()) / 86_400_000);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const cutoffIso = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
    const frontendUrl = getFrontendUrl();

    // 1) Candidate listings: active or off_market, with an agent_id, created
    //    at least 30 days ago. We further narrow by listing_status_history age below.
    const { data: listings, error: listingsErr } = await admin
      .from("listings")
      .select("id, address, city, state, zip_code, status, agent_id, created_at")
      .in("status", ELIGIBLE_STATUSES as unknown as string[])
      .not("agent_id", "is", null)
      .lte("created_at", cutoffIso);

    if (listingsErr) throw listingsErr;

    const candidates = listings ?? [];
    console.log(`[stale-reminders] candidate listings: ${candidates.length}`);

    let enqueued = 0;
    let skippedAlreadySent = 0;
    let skippedRecentChange = 0;
    let skippedNoEmail = 0;

    for (const listing of candidates) {
      // 2) Most recent status change OR fallback to created_at
      const { data: historyRows } = await admin
        .from("listing_status_history")
        .select("changed_at")
        .eq("listing_id", listing.id)
        .order("changed_at", { ascending: false })
        .limit(1);

      const lastChangedIso =
        (historyRows && historyRows[0]?.changed_at) || listing.created_at;
      const lastChangeDays = daysBetween(lastChangedIso, now);
      if (lastChangeDays < STALE_DAYS) {
        skippedRecentChange++;
        continue;
      }

      // 3) Idempotency: have we already reminded this listing in the last 30 days?
      const { data: logRow } = await admin
        .from("listing_reminder_log")
        .select("last_sent_at")
        .eq("listing_id", listing.id)
        .maybeSingle();

      if (logRow?.last_sent_at) {
        const sinceLast = daysBetween(logRow.last_sent_at, now);
        if (sinceLast < STALE_DAYS) {
          skippedAlreadySent++;
          continue;
        }
      }

      // 4) Resolve agent email
      const { data: agent } = await admin
        .from("agent_profiles")
        .select("id, first_name, email")
        .eq("id", listing.agent_id!)
        .maybeSingle();

      if (!agent?.email) {
        skippedNoEmail++;
        continue;
      }

      const statusLabel = STATUS_LABEL[listing.status] ?? listing.status;
      const addressLine = [
        listing.address,
        [listing.city, listing.state, listing.zip_code].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" · ");

      const editUrl = `${frontendUrl}/agent/listings/edit/${listing.id}?ref=stale-reminder`;
      const confirmUrl = `${frontendUrl}/agent/listings/edit/${listing.id}?ref=stale-reminder&confirm=1`;

      const html = buildAacEmail({
        headline: `Quick check on your listing`,
        preheader: `Your listing has been ${statusLabel} for ${lastChangeDays} days — please confirm or update.`,
        body: `
          <p style="margin:0 0 12px;">Hi ${agent.first_name || "there"},</p>
          <p style="margin:0 0 12px;">Your listing at <strong>${addressLine}</strong> has been marked
          <strong>${statusLabel}</strong> for <strong>${lastChangeDays} days</strong> with no status change.</p>
          <p style="margin:0 0 16px;">To keep MLS data accurate, please take a moment to confirm
          the current status — or update it if anything has changed.</p>
          <div style="margin:20px 0;">
            <a href="${confirmUrl}"
               style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;background:#22C55E;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Still accurate — keep as is
            </a>
            <a href="${editUrl}"
               style="display:inline-block;padding:10px 16px;margin:0 0 8px 0;background:#0E56F5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Update status
            </a>
          </div>
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Both buttons take you to your listing
          in AAC, where you can confirm or change the status while signed in.</p>
        `,
      });

      const idempotencyKey = `stale-listing-${listing.id}-${now.getUTCFullYear()}-${String(
        now.getUTCMonth() + 1,
      ).padStart(2, "0")}`;

      const { error: enqueueError } = await admin.from("email_jobs").insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "stale-listing-reminder",
          to: agent.email,
          subject: `Quick check on ${listing.address}`,
          html,
        },
      });

      if (enqueueError) {
        // Duplicate idempotency key (already enqueued this month) → safe to skip.
        if ((enqueueError as any).code === "23505") {
          skippedAlreadySent++;
          continue;
        }
        console.error(`[stale-reminders] enqueue failed for ${listing.id}:`, enqueueError);
        continue;
      }

      const { error: logErr } = await admin.from("listing_reminder_log").upsert({
        listing_id: listing.id,
        last_sent_at: now.toISOString(),
        kind: "stale-listing",
      });
      if (logErr) {
        console.error(`[stale-reminders] reminder log write failed for ${listing.id}:`, logErr);
      }

      enqueued++;
    }

    // Kick the queue once so reminders go out promptly.
    if (enqueued > 0) {
      void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch((err) => {
        console.warn("[stale-reminders] kick-email-queue failed (will run on schedule):", err);
      });
    }

    const summary = {
      candidates: candidates.length,
      enqueued,
      skippedRecentChange,
      skippedAlreadySent,
      skippedNoEmail,
    };
    console.log("[stale-reminders] summary:", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-stale-listing-reminders:", error);
    return new Response(JSON.stringify({ error: error.message ?? "unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);