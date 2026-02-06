import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://allagentconnect.com";

const response = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { ok: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return response(500, {
      ok: false,
      error: "Missing Supabase server configuration",
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SERVICE_ROLE,
      },
    });
  }

  let body: {
    mlsNumber?: string;
    requesterName?: string;
    requesterEmail?: string;
  };

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { ok: false, error: "Invalid JSON body" });
  }

  const { mlsNumber, requesterName, requesterEmail } = body;

  if (!mlsNumber || !requesterName || !requesterEmail) {
    return response(400, {
      ok: false,
      error: "Missing required fields",
      required: ["mlsNumber", "requesterName", "requesterEmail"],
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { error } = await supabase.from("showing_requests").insert({
    mls_number: mlsNumber,
    requester_name: requesterName,
    requester_email: requesterEmail,
    source: "api",
    // TODO: Adjust payload fields if showing_requests schema differs in production.
  });

  if (error) {
    return response(500, { ok: false, error: error.message });
  }

  return response(200, { ok: true });
};
