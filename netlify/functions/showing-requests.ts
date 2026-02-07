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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

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
