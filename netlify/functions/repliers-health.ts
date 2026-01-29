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
  const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";

  // Check if API key is configured
  if (!apiKey) {
    console.error("[repliers-health] REPLIERS_API_KEY not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "REPLIERS_API_KEY environment variable not set",
        envConfigured: false,
      }),
    };
  }

  try {
    // Try a minimal API call to verify connectivity
    // Using listings with minimal results to reduce load
    const testUrl = "https://api.repliers.io/listings?resultsPerPage=1";

    console.log("[repliers-health] Testing upstream connectivity...");

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[repliers-health] Upstream unhealthy:", {
        status: response.status,
        body: errorText.substring(0, 200),
      });

      return {
        statusCode: 200, // Return 200 so health check itself works, but indicate upstream issue
        headers,
        body: JSON.stringify({
          ok: false,
          envConfigured: true,
          upstreamStatus: response.status,
          upstreamHealthy: false,
          authHeader: authHeaderName,
          error: `Upstream returned ${response.status}`,
        }),
      };
    }

    console.log("[repliers-health] Upstream healthy");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        envConfigured: true,
        upstreamHealthy: true,
        authHeader: authHeaderName,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (e: any) {
    console.error("[repliers-health] Error:", e?.message || e);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        envConfigured: true,
        upstreamHealthy: false,
        error: e?.message || "Connection error",
      }),
    };
  }
};
