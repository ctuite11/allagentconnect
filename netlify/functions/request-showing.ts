import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://allagentconnect.com";
const REQUIRE_AUTH = false;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonValue = Record<string, unknown>;

function jsonResponse(statusCode: number, body: JsonValue) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  };
}

async function queueEmail(
  supabase: ReturnType<typeof createClient>,
  payload: {
    to: string | string[];
    subject: string;
    html: string;
  },
) {
  const { error } = await supabase.from("email_jobs").insert({
    status: "queued",
    attempts: 0,
    payload: {
      provider: "resend",
      template: "custom",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      variables: {},
    },
  });

  if (error) {
    throw new Error(`Failed to queue email: ${error.message}`);
  }
}

function buildRequesterEmail(mlsNumber: string, requesterName: string): string {
  return `
    <p>Hi ${requesterName},</p>
    <p>Thanks for your showing request for MLS <strong>${mlsNumber}</strong>.</p>
    <p>We received your request and will route it to the listing agent/network shortly.</p>
    <p>— All Agent Connect</p>
  `;
}

function buildInternalEmail(args: {
  mlsNumber: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  message?: string;
  createdAt: string;
  showingRequestId: string | null;
}): string {
  const { mlsNumber, requesterName, requesterEmail, requesterPhone, message, createdAt, showingRequestId } = args;

  return `
    <h2>New Showing Request</h2>
    <p><strong>Showing Request ID:</strong> ${showingRequestId ?? "N/A"}</p>
    <p><strong>Created At:</strong> ${createdAt}</p>
    <p><strong>MLS Number:</strong> ${mlsNumber}</p>
    <p><strong>Requester Name:</strong> ${requesterName}</p>
    <p><strong>Requester Email:</strong> ${requesterEmail}</p>
    <p><strong>Requester Phone:</strong> ${requesterPhone || "Not provided"}</p>
    <p><strong>Message:</strong> ${message || "Not provided"}</p>
  `;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
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

  let body: {
    mlsNumber?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    message?: string;
  };

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { mlsNumber, requesterName, requesterEmail, requesterPhone, message } = body;

  if (!mlsNumber || !requesterName || !requesterEmail) {
    return jsonResponse(400, {
      ok: false,
      error: "Missing required fields",
    });
  }

  if (REQUIRE_AUTH) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return jsonResponse(401, { ok: false, error: "Authentication required" });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(401, { ok: false, error: "Authentication required" });
    }

    const { data: agentSettings, error: verifiedError } = await supabase
      .from("agent_settings")
      .select("agent_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (verifiedError) {
      return jsonResponse(500, { ok: false, error: verifiedError.message });
    }

    if (!agentSettings || agentSettings.agent_status !== "verified") {
      return jsonResponse(403, { ok: false, error: "Verified agent required" });
    }
  }

  const baseShowingRequestInsert = {
    mls_number: mlsNumber,
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: requesterPhone ?? null,
    message: message ?? null,
  };

  let { data: inserted, error: insertError } = await supabase
    .from("showing_requests")
    .insert({
      ...baseShowingRequestInsert,
      source: "api",
    })
    .select("id, created_at")
    .maybeSingle();

  if (insertError && /column .*source.* does not exist/i.test(insertError.message)) {
    ({ data: inserted, error: insertError } = await supabase
      .from("showing_requests")
      .insert(baseShowingRequestInsert)
      .select("id, created_at")
      .maybeSingle());
  }

  if (insertError) {
    return jsonResponse(500, { ok: false, error: insertError.message });
  }

  const showingRequestId = inserted?.id ?? null;
  const createdAt = inserted?.created_at ?? new Date().toISOString();

  try {
    await queueEmail(supabase, {
      to: requesterEmail,
      subject: `Showing request received — ${mlsNumber}`,
      html: buildRequesterEmail(mlsNumber, requesterName),
    });

    await queueEmail(supabase, {
      to: "hello@allagentconnect.com",
      subject: `New showing request — ${mlsNumber}`,
      html: buildInternalEmail({
        mlsNumber,
        requesterName,
        requesterEmail,
        requesterPhone,
        message,
        createdAt,
        showingRequestId,
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to queue emails";
    return jsonResponse(500, { ok: false, error: errorMessage });
  }

  return jsonResponse(200, {
    ok: true,
    showingRequestId,
    emailsQueued: true,
  });
};
