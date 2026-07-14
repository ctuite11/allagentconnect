import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AAC_PUBLIC_URL } from "../_shared/aacPublicUrl.ts";
import {
  getVerifiedAgentAudience,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import {
  countExistingReminders,
  reserveAndEnqueueMissingOpportunityReminder,
} from "../_shared/missingOpportunitiesEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SellerAlertRequest {
  submission_id: string;
  dry_run?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const baseUrl = AAC_PUBLIC_URL;

    const { submission_id, dry_run }: SellerAlertRequest = await req.json();
    if (!submission_id) throw new Error("submission_id is required");
    const dryRun: boolean = dry_run === true;

    const { data: submission, error: subError } = await supabase
      .from("agent_match_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();
    if (subError || !submission) {
      throw new Error(`Submission not found: ${subError?.message}`);
    }

    // Canonical audience
    const audience = await getVerifiedAgentAudience(supabase);
    const audienceIds = audience.map((a) => a.agent_id);

    // Independent-dimension Comms-Center match against the seller submission.
    // Hot-sheet criteria are no longer used for match determination; hot-sheet
    // rows are still consulted below for `agent_match_deliveries.hot_sheet_id`
    // provenance so we can attribute the alert to a specific saved search.
    const price = parseFloat(submission.asking_price) || 0;
    const preferenceEvent = {
      state: submission.state ?? null,
      city: submission.city ?? null,
      neighborhood: submission.neighborhood ?? null,
      price: price > 0 ? price : null,
      propertyTypes: submission.property_type ? [String(submission.property_type)] : [],
    };

    // Best-effort hot-sheet attribution (for delivery row provenance only).
    const { data: hotSheets } = await supabase
      .from("hot_sheets")
      .select("id, user_id, criteria")
      .eq("is_active", true)
      .in("user_id", audienceIds);
    const matchHotSheetByAgent = new Map<string, string[]>();
    for (const hs of hotSheets || []) {
      const c = hs.criteria || {};
      if (c.cities?.length && !c.cities.includes(submission.city)) continue;
      if (c.state && String(c.state).toLowerCase() !== String(submission.state || "").toLowerCase()) continue;
      if (c.propertyTypes?.length && !c.propertyTypes.includes(submission.property_type)) continue;
      if (c.minPrice && price < parseFloat(c.minPrice)) continue;
      if (c.maxPrice && price > parseFloat(c.maxPrice)) continue;
      if (c.bedrooms && (submission.bedrooms || 0) < parseInt(c.bedrooms)) continue;
      if (c.bathrooms && (submission.bathrooms || 0) < parseFloat(c.bathrooms)) continue;
      const arr = matchHotSheetByAgent.get(hs.user_id) || [];
      arr.push(hs.id);
      matchHotSheetByAgent.set(hs.user_id, arr);
    }

    // Sender exclusion: if the seller is a linked agent user
    const senderId: string | null = submission.agent_id || submission.user_id || null;

    const partition = partitionAudience<EligibleAgent>(
      audience,
      (a) => matchesCommunicationPreferences(a.savedPrefs, preferenceEvent).matches,
      senderId,
    );

    // Skip agents already notified for this submission (durable dedup)
    const realIds = partition.real.map((r) => r.agent_id);
    const { data: existingDeliveries } = realIds.length
      ? await supabase
          .from("agent_match_deliveries")
          .select("agent_id, notified_agent_at")
          .eq("submission_id", submission_id)
          .in("agent_id", realIds)
      : { data: [] as any[] };
    const notifiedSet = new Set(
      (existingDeliveries || [])
        .filter((d: any) => d.notified_agent_at)
        .map((d: any) => d.agent_id),
    );
    const freshReal = partition.real.filter((r) => !notifiedSet.has(r.agent_id));

    // Reminder pre-check
    const reminderIds = partition.reminder.map((a) => a.agent_id);
    const alreadyReminded = await countExistingReminders(
      supabase,
      "seller_alert",
      submission_id,
      reminderIds,
    );
    const freshReminder = partition.reminder.filter((a) => !alreadyReminded.has(a.agent_id));

    const baseReport = {
      submission_id,
      activated_verified_audience: audience.length,
      profile_complete: partition.counts.profile_complete,
      profile_incomplete: partition.counts.profile_incomplete,
      no_email: partition.counts.no_email,
      preferences_matched: partition.counts.preferences_matched,
      preferences_unset_fallback: partition.counts.preferences_unset_fallback,
      self_excluded: partition.counts.self_excluded,
      category_opted_out: partition.counts.category_opted_out,
      non_matching: partition.counts.non_matching,
      already_received_real: notifiedSet.size,
      reminder_already_recorded: alreadyReminded.size,
      final_real_recipients: freshReal.length,
      final_reminder_recipients: freshReminder.length,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, ...baseReport }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (freshReal.length === 0 && freshReminder.length === 0) {
      return new Response(
        JSON.stringify({ success: true, ...baseReport, real_enqueued: 0, reminder_enqueued: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const priceFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
    const locationWithNeighborhood = submission.neighborhood
      ? `${submission.city}, ${submission.neighborhood}`
      : submission.city;
    const detailsUrl = `${baseUrl}/seller-listing/${submission_id}`;

    const emailJobs: any[] = [];
    for (const r of freshReal) {
      const hotSheetIds = matchHotSheetByAgent.get(r.agent_id) || [];

      // Record delivery row per hot sheet, or a single sentinel for fallback cohort
      if (hotSheetIds.length > 0) {
        for (const hsId of hotSheetIds) {
          await supabase.from("agent_match_deliveries").upsert(
            { submission_id, agent_id: r.agent_id, hot_sheet_id: hsId },
            { onConflict: "submission_id,agent_id,hot_sheet_id" },
          );
        }
      } else {
        await supabase.from("agent_match_deliveries").upsert(
          { submission_id, agent_id: r.agent_id, hot_sheet_id: null as any },
          { onConflict: "submission_id,agent_id,hot_sheet_id" },
        );
      }

      const propertySnapshotLines = [
        `<li><strong>Location:</strong> ${locationWithNeighborhood}${submission.state ? `, ${submission.state}` : ""}</li>`,
        `<li><strong>Property type:</strong> ${submission.property_type}</li>`,
        `<li><strong>Beds / Baths:</strong> ${submission.bedrooms} / ${submission.bathrooms}</li>`,
        `<li><strong>Square feet:</strong> ${submission.square_feet?.toLocaleString() || "N/A"}</li>`,
        `<li><strong>Asking price:</strong> ${priceFormatted}</li>`,
      ];
      if (submission.buyer_agent_commission) {
        propertySnapshotLines.push(
          `<li><strong>Buyer agent commission:</strong> ${submission.buyer_agent_commission}</li>`,
        );
      }

      const contactMethodLabel =
        submission.preferred_contact_method === "text"
          ? "Text message"
          : submission.preferred_contact_method === "phone"
          ? "Phone call"
          : "Email";

      emailJobs.push({
        idempotency_key: `seller-alert:${submission_id}:${r.agent_id}`,
        payload: {
          provider: "resend",
          template: "seller-alert",
          to: r.email,
          subject: "Seller Alert: Home matches your active buyer needs",
          reply_to: submission.seller_email,
          metadata: { audience: "agent", reason: r.reason, submission_id },
          variables: {
            agentName: r.first_name || "Agent",
            propertyHtml: `<ul style="list-style: none; padding: 0;">${propertySnapshotLines.join("")}</ul>`,
            contactMethod: contactMethodLabel,
            viewLink: detailsUrl,
            submissionId: submission_id,
            contentHtml: `
              <p>Hi ${r.first_name || "Agent"},</p>
              <p>A homeowner has submitted a private Seller Match listing${r.reason === "preferences_match" ? " that aligns with your active buyer criteria" : ""}.</p>
              <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
                <p style="font-weight: 600;">Property snapshot</p>
                <ul style="list-style: none; padding: 0;">${propertySnapshotLines.join("")}</ul>
              </div>
              <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
                <p><strong>Preferred contact method:</strong> ${contactMethodLabel}</p>
              </div>
              <p><a href="${detailsUrl}" style="display: inline-block; background: #0F172A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Seller Match Listing →</a></p>
            `,
          },
        },
      });

      await supabase
        .from("agent_match_deliveries")
        .update({ notified_agent_at: new Date().toISOString() })
        .eq("submission_id", submission_id)
        .eq("agent_id", r.agent_id);
    }

    if (emailJobs.length > 0) {
      const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);
      if (insertError) console.error("[send-seller-alert] enqueue failed:", insertError);
    }

    // Reminder enqueue via reserve-first RPC.
    let reminderEnqueued = 0;
    let reminderConflict = 0;
    for (const a of partition.reminder) {
      const res = await reserveAndEnqueueMissingOpportunityReminder(supabase, {
        agent_id: a.agent_id,
        event_type: "seller_alert",
        event_id: submission_id,
        email: a.email,
        firstName: a.first_name,
        baseUrl,
      });
      if (res.queued) reminderEnqueued++;
      else if (!res.reserved) reminderConflict++;
      else if (res.error) console.error("[send-seller-alert] reminder RPC error:", res.error);
    }

    console.log(
      `[send-seller-alert] submission=${submission_id} real_enqueued=${emailJobs.length} reminder_enqueued=${reminderEnqueued}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...baseReport,
        real_enqueued: emailJobs.length,
        reminder_enqueued: reminderEnqueued,
        reminder_skipped_duplicate: reminderConflict,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("[send-seller-alert] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});