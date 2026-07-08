import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://allagentconnect.com";

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  const ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, {
      ok: false,
      error: "Missing Supabase server configuration",
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SERVICE_ROLE,
      },
    });
  }

  // --- AuthN/AuthZ: require a valid Supabase JWT with agent or admin role ---
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  if (!ANON_KEY) {
    return json(500, { ok: false, error: "Missing Supabase anon key configuration" });
  }
  const jwt = authHeader.replace(/^[Bb]earer\s+/, "");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  const callerId = userData.user.id;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const [{ data: isAgent }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: callerId, _role: "agent" }),
    supabase.rpc("has_role", { _user_id: callerId, _role: "admin" }),
  ]);
  if (isAgent !== true && isAdmin !== true) {
    return json(403, { ok: false, error: "Forbidden: agent or admin role required" });
  }

  const status = event.queryStringParameters?.status || "";
  const q = (event.queryStringParameters?.q || "").trim();
  const limitRaw = event.queryStringParameters?.limit || "50";
  const limit = Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50));

  let query = supabase
    .from("showing_requests")
    .select(
      "id,created_at,mls_number,requester_name,requester_email,requester_phone,message,status,assigned_to_user_id,notes"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  if (q) {
    query = query.or(
      `mls_number.ilike.%${q}%,requester_name.ilike.%${q}%,requester_email.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return json(500, { ok: false, error: error.message });

  return json(200, { ok: true, data: data || [] });
};
