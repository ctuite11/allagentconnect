// supabase/functions/seed-proposal-test-data/index.ts
// Proposal System Test Harness - Admin-only dark-launch infrastructure
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Action = "seed" | "reset";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    if (req.method !== "POST") return json({ error: "Use POST" }, 405);

    // ---- Secret header lock ----
    const providedSecret = req.headers.get("x-seed-secret") || "";
    const expectedSecret = Deno.env.get("SEED_PROPOSAL_TEST_SECRET") || "";
    if (!expectedSecret) return json({ error: "Missing env var SEED_PROPOSAL_TEST_SECRET" }, 500);
    if (providedSecret !== expectedSecret) return json({ error: "Forbidden" }, 403);

    // ---- Supabase client as CALLER (no service role) ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Must be signed in (verify_jwt=true already enforces this, but we double-check)
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = authData.user.id;

    // ---- Admin check via has_role(_user_id, _role) ----
    const { data: isAdmin, error: adminErr } = await supabase
      .rpc("has_role", { _user_id: callerId, _role: "admin" });

    if (adminErr) return json({ error: "Admin check failed", details: adminErr.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden (admin only)" }, 403);

    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "seed") as Action;

    const ADMIN_AGENT_ID = "1fc50da1-2664-4931-8cab-64e24dc5ed8c";
    const TEST_SUBMISSION_ID = "327b8d41-95ba-4765-9b4a-ef3c38a1e595";

    // ---------------- RESET ----------------
    if (action === "reset") {
      const results: Record<string, unknown> = {};

      const r1 = await supabase
        .from("agent_settings")
        .update({ show_buyer_proposal: false, show_seller_proposal: false })
        .eq("user_id", ADMIN_AGENT_ID);
      results.agent_settings_reset = r1.error ? r1.error.message : "ok";

      const r2 = await supabase
        .from("agent_proposal_incentives")
        .delete()
        .eq("agent_id", ADMIN_AGENT_ID);
      results.incentives_deleted = r2.error ? r2.error.message : "ok";

      const r3 = await supabase
        .from("buyer_qualifications")
        .delete()
        .eq("user_id", ADMIN_AGENT_ID);
      results.buyer_qual_deleted = r3.error ? r3.error.message : "ok";

      const r4 = await supabase
        .from("agent_match_submissions")
        .update({ receive_listing_proposals: false })
        .eq("id", TEST_SUBMISSION_ID);
      results.agent_match_reset = r4.error ? r4.error.message : "ok";

      return json({ ok: true, action, callerId, results });
    }

    // ---------------- SEED ----------------
    const results: Record<string, unknown> = {};

    const s1 = await supabase
      .from("agent_settings")
      .update({ show_buyer_proposal: true, show_seller_proposal: true })
      .eq("user_id", ADMIN_AGENT_ID);
    results.agent_settings_updated = s1.error ? s1.error.message : "ok";

    const s2 = await supabase
      .from("agent_proposal_incentives")
      .upsert(
        {
          agent_id: ADMIN_AGENT_ID,
          buyer_fee_credit_type: "percentage",
          buyer_fee_credit_value: 1.0,
          flat_fee_option: true,
          flat_fee_amount: 9500,
          custom_incentive_notes: "Test incentive — internal only",
        },
        { onConflict: "agent_id" }
      );
    results.incentives_upserted = s2.error ? s2.error.message : "ok";

    const s3 = await supabase
      .from("buyer_qualifications")
      .upsert(
        {
          user_id: ADMIN_AGENT_ID,
          qualification_method: "documentation_agreement",
          documentation_agreed: true,
          documentation_agreed_at: new Date().toISOString(),
          receive_agent_proposals: true,
        },
        { onConflict: "user_id" }
      );
    results.buyer_qual_upserted = s3.error ? s3.error.message : "ok";

    const s4 = await supabase
      .from("agent_match_submissions")
      .update({ receive_listing_proposals: true })
      .eq("id", TEST_SUBMISSION_ID);
    results.agent_match_updated = s4.error ? s4.error.message : "ok";

    // Readbacks
    const v1 = await supabase
      .from("agent_settings")
      .select("user_id, show_buyer_proposal, show_seller_proposal")
      .eq("user_id", ADMIN_AGENT_ID)
      .single();
    results.verify_agent_settings = v1.error ? v1.error.message : v1.data;

    const v2 = await supabase
      .from("agent_proposal_incentives")
      .select("*")
      .eq("agent_id", ADMIN_AGENT_ID)
      .single();
    results.verify_incentives = v2.error ? v2.error.message : v2.data;

    const v3 = await supabase
      .from("buyer_qualifications")
      .select("*")
      .eq("user_id", ADMIN_AGENT_ID)
      .single();
    results.verify_buyer_qual = v3.error ? v3.error.message : v3.data;

    const v4 = await supabase
      .from("agent_match_submissions")
      .select("id, receive_listing_proposals")
      .eq("id", TEST_SUBMISSION_ID)
      .single();
    results.verify_submission = v4.error ? v4.error.message : v4.data;

    return json({ ok: true, action, callerId, results });
  } catch (e) {
    return json({ error: "Unhandled error", details: String(e) }, 500);
  }
});
