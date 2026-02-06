import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

interface ShowingRequestPayload {
  mlsNumber?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  preferredDates?: string;
  preferredTimeWindow?: string;
  message?: string;
  listingAddress?: string;
  listingCity?: string;
  listingState?: string;
  listingZip?: string;
  listingAgentName?: string;
  listingAgentPhone?: string;
  listingAgentEmail?: string;
}

const cors = (origin: string | undefined) => {
  const o = origin || "";
  const allowed =
    o === "https://allagentconnect.com" ||
    o.endsWith(".netlify.app") ||
    o === "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowed ? o : "https://allagentconnect.com",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

function isBlank(value?: string): boolean {
  return !value || value.trim().length === 0;
}

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = { "Content-Type": "application/json", ...cors(origin) };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const payload: ShowingRequestPayload = JSON.parse(event.body || "{}");

    if (isBlank(payload.mlsNumber) || isBlank(payload.requesterName) || isBlank(payload.requesterEmail)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Missing required fields: mlsNumber, requesterName, requesterEmail",
        }),
      };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: "Missing Supabase server configuration" }),
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const insertPayload = {
      mls_number: payload.mlsNumber.trim(),
      listing_address: payload.listingAddress?.trim() || null,
      listing_city: payload.listingCity?.trim() || null,
      listing_state: payload.listingState?.trim() || null,
      listing_zip: payload.listingZip?.trim() || null,
      requester_name: payload.requesterName.trim(),
      requester_email: payload.requesterEmail.trim(),
      requester_phone: payload.requesterPhone?.trim() || null,
      message: payload.message?.trim() || null,
      preferred_dates: payload.preferredDates?.trim() || null,
      preferred_time_window: payload.preferredTimeWindow?.trim() || null,
      listing_agent_name: payload.listingAgentName?.trim() || null,
      listing_agent_phone: payload.listingAgentPhone?.trim() || null,
      listing_agent_email: payload.listingAgentEmail?.trim() || null,
    };

    const { error: insertError } = await supabase.from("showing_requests").insert(insertPayload);

    if (insertError) {
      console.error("[request-showing] Supabase insert failed", insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: "Failed to save showing request" }),
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }),
      };
    }

    const fromAddress = process.env.RESEND_FROM || process.env.EMAIL_FROM || "All Agent Connect <hello@allagentconnect.com>";
    const fallbackRecipient = "hello@allagentconnect.com";
    const toAddress = payload.listingAgentEmail?.trim() || fallbackRecipient;

    const subject = `Showing request: ${payload.mlsNumber.trim()}`;
    const textBody = [
      "New showing request submitted",
      "",
      `MLS Number: ${payload.mlsNumber.trim()}`,
      `Listing Address: ${payload.listingAddress || "N/A"}`,
      `Listing City/State/Zip: ${[payload.listingCity, payload.listingState, payload.listingZip].filter(Boolean).join(" ") || "N/A"}`,
      "",
      `Requester Name: ${payload.requesterName.trim()}`,
      `Requester Email: ${payload.requesterEmail.trim()}`,
      `Requester Phone: ${payload.requesterPhone || "N/A"}`,
      "",
      `Preferred Dates: ${payload.preferredDates || "N/A"}`,
      `Preferred Time Window: ${payload.preferredTimeWindow || "N/A"}`,
      "",
      "Message:",
      payload.message || "N/A",
      "",
      `Listing Agent Name: ${payload.listingAgentName || "N/A"}`,
      `Listing Agent Phone: ${payload.listingAgentPhone || "N/A"}`,
      `Listing Agent Email: ${payload.listingAgentEmail || "N/A"}`,
    ].join("\n");

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        subject,
        text: textBody,
      }),
    });

    if (!resendResp.ok) {
      const resendError = await resendResp.json().catch(() => ({}));
      console.error("[request-showing] Resend error", {
        status: resendResp.status,
        resendError,
      });
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ ok: false, error: "Failed to send request email" }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (error: unknown) {
    console.error("[request-showing] Unexpected error", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: message }),
    };
  }
};
