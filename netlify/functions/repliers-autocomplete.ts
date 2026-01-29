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
    "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
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
    console.error("[repliers-autocomplete] REPLIERS_API_KEY not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  const query = event.queryStringParameters?.q || "";

  if (!query || query.length < 2) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Query must be at least 2 characters" }),
    };
  }

  // Sanitize and limit query length
  const sanitizedQuery = query.substring(0, 100).trim();

  try {
    // Note: Repliers autocomplete endpoint may vary - adjust URL as needed
    const upstreamUrl = `https://api.repliers.io/autocomplete?q=${encodeURIComponent(sanitizedQuery)}`;

    // Configurable auth header
    const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";

    // If using Authorization header, format as Bearer token
    const authHeaderValue =
      authHeaderName.toLowerCase() === "authorization"
        ? `Bearer ${apiKey}`
        : apiKey;

    console.log("[repliers-autocomplete] Searching:", sanitizedQuery);

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[repliers-autocomplete] Upstream error:", {
        status: response.status,
        body: errorText.substring(0, 500),
      });

      // If autocomplete isn't supported, return empty results gracefully
      if (response.status === 404) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ suggestions: [], note: "Autocomplete not available" }),
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
    console.error("[repliers-autocomplete] Error:", e?.message || e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e?.message || "Internal error" }),
    };
  }
};
