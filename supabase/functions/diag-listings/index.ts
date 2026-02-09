import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? "unknown";

    // Parse optional agent_id from query params
    const url = new URL(req.url);
    const requestedAgentId = url.searchParams.get("agent_id");

    // Determine caller identity from JWT (if provided)
    let callerId: string | null = null;
    let callerIsAdmin = false;
    const authHeader = req.headers.get("Authorization");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (!claimsErr && claimsData?.claims?.sub) {
        callerId = claimsData.claims.sub as string;
        // Check admin role
        const { data: adminCheck } = await adminClient.rpc("has_role", {
          _user_id: callerId,
          _role: "admin",
        });
        callerIsAdmin = adminCheck === true;
      }
    }

    // 1. Total listings count by status
    const { data: statusCounts, error: statusErr } = await adminClient
      .from("listings")
      .select("status");

    if (statusErr) {
      return new Response(
        JSON.stringify({ error: "Failed to query listings", detail: statusErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listingsByStatus: Record<string, number> = {};
    let listingsTotal = 0;
    for (const row of statusCounts || []) {
      listingsByStatus[row.status] = (listingsByStatus[row.status] || 0) + 1;
      listingsTotal++;
    }

    // 2. Agent-specific check (only if caller is the agent or admin)
    let agentCheck: Record<string, unknown> | null = null;
    const targetAgentId = requestedAgentId || callerId;

    if (targetAgentId) {
      const canViewAgent =
        callerIsAdmin || callerId === targetAgentId;

      if (canViewAgent) {
        const { data: agentListings } = await adminClient
          .from("listings")
          .select("id, status")
          .eq("agent_id", targetAgentId);

        const agentByStatus: Record<string, number> = {};
        let agentTotal = 0;
        const sampleIds: string[] = [];

        for (const row of agentListings || []) {
          agentByStatus[row.status] = (agentByStatus[row.status] || 0) + 1;
          agentTotal++;
          if (sampleIds.length < 3) sampleIds.push(row.id);
        }

        agentCheck = {
          agentId: targetAgentId,
          listingsCount: agentTotal,
          listingsByStatus: agentByStatus,
          sampleListingIds: sampleIds,
        };
      }
    }

    const result = {
      projectRef,
      supabaseUrl,
      serverTime: new Date().toISOString(),
      listingsTotal,
      listingsByStatus,
      callerId,
      callerIsAdmin,
      agentCheck,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
