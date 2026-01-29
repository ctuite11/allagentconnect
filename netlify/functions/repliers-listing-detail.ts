import type { Handler } from "@netlify/functions";

// CORS helper - allows production, deploy previews, and local dev
const cors = (origin: string | undefined) => {
  const o = origin || "";
  const allowed =
    o === "https://allagentconnect.com" ||
    o.endsWith(".netlify.app") ||
    o.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": allowed ? o : "https://allagentconnect.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
};

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=120, stale-while-revalidate=300",
    ...cors(origin),
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) {
    console.error("[repliers-listing-detail] REPLIERS_API_KEY not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  // Extract listing ID from path
  // Netlify passes the original path; we need to extract the ID
  // Path format: /api/repliers/listing/:id -> we get the full path
  const path = event.path || "";
  const listingId = event.queryStringParameters?.id || path.split("/").pop();

  if (!listingId || listingId === "listing") {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Listing ID required" }),
    };
  }

  // Validate listing ID format (alphanumeric, dashes, underscores)
  if (!/^[\w-]+$/.test(listingId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid listing ID format" }),
    };
  }

  try {
    const upstreamUrl = `https://api.repliers.io/listings/${encodeURIComponent(listingId)}`;

    // Configurable auth header
    const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";

    // If using Authorization header, format as Bearer token
    const authHeaderValue =
      authHeaderName.toLowerCase() === "authorization"
        ? `Bearer ${apiKey}`
        : apiKey;

    console.log("[repliers-listing-detail] Fetching listing:", listingId);

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[repliers-listing-detail] Upstream error:", {
        status: response.status,
        listingId,
        body: errorText.substring(0, 500),
      });

      if (response.status === 404) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Listing not found" }),
        };
      }

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Upstream API error",
          status: response.status,
        }),
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (e: any) {
    console.error("[repliers-listing-detail] Error:", e?.message || e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e?.message || "Internal error" }),
    };
  }
};
