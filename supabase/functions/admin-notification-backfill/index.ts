import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Same qualifying-status set as notify-agents-new-listing.
const QUALIFYING_STATUSES = [
  "active",
  "coming_soon",
  "price_changed",
  "back_on_market",
  "extended",
  "reactivated",
  "new",
  "off_market",
];

type Target = "latest_listing" | "latest_client_need" | "both";

interface Body {
  target?: Target;
  dry_run?: boolean;
  listing_id?: string;
  client_need_id?: string;
}

async function invokeFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Admin authentication -------------------------------------------------
    // Require a valid authenticated admin session. We validate the caller's
    // JWT with an anon-key client, then check the user has the 'admin' role
    // via user_roles + has_role RPC (SECURITY DEFINER).
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "missing bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) {
      return new Response(
        JSON.stringify({ error: "admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Parse + resolve targets ---------------------------------------------
    const body = (await req.json().catch(() => ({}))) as Body;
    const target: Target = (body.target as Target) ?? "both";
    const dryRun = body.dry_run !== false; // default TRUE for safety
    const listingIdOverride = body.listing_id ?? null;
    const clientNeedIdOverride = body.client_need_id ?? null;

    const result: Record<string, unknown> = {
      dry_run: dryRun,
      target,
      caller: userData.user.id,
    };

    // Listing ----------------------------------------------------------------
    if (target === "latest_listing" || target === "both") {
      let listingId = listingIdOverride;
      if (!listingId) {
        const { data: latest, error: lErr } = await admin
          .from("listings")
          .select("id, status, created_at")
          .in("status", QUALIFYING_STATUSES)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        listingId = latest?.id ?? null;
      } else {
        // Validate override still qualifies for the automatic path.
        const { data: chk } = await admin
          .from("listings")
          .select("id, status")
          .eq("id", listingId)
          .maybeSingle();
        if (!chk || !QUALIFYING_STATUSES.includes(String(chk.status ?? ""))) {
          return new Response(
            JSON.stringify({
              error: "listing_id override does not qualify for the automatic notification path",
              listing_id: listingIdOverride,
              status: chk?.status ?? null,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (!listingId) {
        result.listing = { skipped: true, reason: "no qualifying listing found" };
      } else {
        const { status, json } = await invokeFunction("notify-agents-new-listing", {
          listing_id: listingId,
          dry_run: dryRun,
        });
        result.listing = { http_status: status, ...(json ?? {}) };
      }
    }

    // Client need ------------------------------------------------------------
    if (target === "latest_client_need" || target === "both") {
      let clientNeedId = clientNeedIdOverride;
      if (!clientNeedId) {
        const { data: latest, error: cErr } = await admin
          .from("client_needs")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cErr) throw cErr;
        clientNeedId = latest?.id ?? null;
      } else {
        const { data: chk } = await admin
          .from("client_needs")
          .select("id")
          .eq("id", clientNeedId)
          .maybeSingle();
        if (!chk) {
          return new Response(
            JSON.stringify({
              error: "client_need_id override not found",
              client_need_id: clientNeedIdOverride,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (!clientNeedId) {
        result.client_need = { skipped: true, reason: "no client need found" };
      } else {
        const { status, json } = await invokeFunction("notify-agents-client-need", {
          client_need_id: clientNeedId,
          dry_run: dryRun,
        });
        result.client_need = { http_status: status, ...(json ?? {}) };
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[admin-notification-backfill] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});