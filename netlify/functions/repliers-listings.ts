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

// Allowlisted query params that can be forwarded to Repliers
const ALLOWED_PARAMS = new Set([
  "city",
  "neighborhood",
  "area",
  "minPrice",
  "maxPrice",
  "minBeds",
  "maxBeds",
  "minBaths",
  "maxBaths",
  "propertyType",
  "status",
  "pageNum",
  "resultsPerPage",
  "sortBy",
  "sortOrder",
  "class",
  "type",
  "lastStatus",
]);

const MAX_PAGE_SIZE = 50;

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
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
    console.error("[repliers-listings] REPLIERS_API_KEY not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    // Filter and validate query params
    const queryParams = event.queryStringParameters || {};
    const filteredParams = new URLSearchParams();

    for (const [key, value] of Object.entries(queryParams)) {
      if (ALLOWED_PARAMS.has(key) && value) {
        // Enforce max page size
        if (key === "resultsPerPage") {
          const size = Math.min(parseInt(value, 10) || 20, MAX_PAGE_SIZE);
          filteredParams.set(key, String(size));
        } else {
          filteredParams.set(key, value);
        }
      }
    }

    // Build upstream URL
    const queryString = filteredParams.toString();
    const upstreamUrl = `https://api.repliers.io/listings${queryString ? `?${queryString}` : ""}`;

    // Configurable auth header (default: REPLIERS-API-KEY, can override via env)
    const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";

    // If using Authorization header, format as Bearer token
    const authHeaderValue =
      authHeaderName.toLowerCase() === "authorization"
        ? `Bearer ${apiKey}`
        : apiKey;

    // Debug: confirm auth header configuration (no secrets logged)
    console.log("[repliers-listings] auth header name:", authHeaderName);
    console.log("[repliers-listings] auth value starts with Bearer:", authHeaderValue.startsWith("Bearer "));
    console.log("[repliers-listings] Fetching:", upstreamUrl.replace(apiKey, "***"));

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[repliers-listings] Upstream error:", {
        status: response.status,
        body: errorText.substring(0, 500),
      });
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
    console.error("[repliers-listings] Error:", e?.message || e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e?.message || "Internal error" }),
    };
  }
};
