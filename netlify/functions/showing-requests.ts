import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://allagentconnect.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function jsonResponse(statusCode: number, body: JsonObject) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse(500, {
      ok: false,
      error: "Missing Supabase server configuration",
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SERVICE_ROLE,
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const status = event.queryStringParameters?.status?.trim();
  const q = event.queryStringParameters?.q?.trim();
  const requestedLimit = Number.parseInt(event.queryStringParameters?.limit ?? "50", 10);
  const limit = Number.isNaN(requestedLimit) ? 50 : Math.max(1, Math.min(requestedLimit, 200));

  let query = supabase
    .from("showing_requests")
    .select("id, created_at, mls_number, requester_name, requester_email, requester_phone, message, status, assigned_to_user_id, notes")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (q) {
    const sanitized = q.replace(/,/g, " ");
    query = query.or(`mls_number.ilike.%${sanitized}%,requester_name.ilike.%${sanitized}%,requester_email.ilike.%${sanitized}%`);
  }

  const { data, error } = await query;

  if (error) {
    return jsonResponse(500, { ok: false, error: error.message });
  }

  return jsonResponse(200, {
    ok: true,
    data: data ?? [],
  });
};
