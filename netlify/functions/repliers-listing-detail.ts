import type { Handler } from "@netlify/functions";

import { buildCorsHeaders } from "./repliers-utils";

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin, "GET, OPTIONS");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=120, stale-while-revalidate=300",
    ...cors.headers,
  };

  if (cors.isBrowserRequest && !cors.isAllowedOrigin) {
    return { statusCode: 403, headers, body: "" };
  }

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

  const mlsNumber = event.queryStringParameters?.mlsNumber;

  if (!mlsNumber) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "mlsNumber required" }),
    };
  }

  try {
    // Configurable auth header
    const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";

    // If using Authorization header, format as Bearer token
    const authHeaderValue =
      authHeaderName.toLowerCase() === "authorization"
        ? `Bearer ${apiKey}`
        : apiKey;

    const lookupUrl = `https://api.repliers.io/listings?mlsNumber=${encodeURIComponent(
      mlsNumber
    )}&resultsPerPage=1`;

    console.log("[repliers-listing-detail] Fetching listing by MLS:", mlsNumber);

    const lookupResponse = await fetch(lookupUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
    });

    if (!lookupResponse.ok) {
      const errorText = await lookupResponse.text().catch(() => "Unknown error");
      console.error("[repliers-listing-detail] Upstream error:", {
        status: lookupResponse.status,
        mlsNumber,
        body: errorText.substring(0, 500),
      });

      if (lookupResponse.status === 404) {
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
          status: lookupResponse.status,
        }),
      };
    }

    const lookupData = await lookupResponse.json();
    const listings = Array.isArray(lookupData?.listings) ? lookupData.listings : [];
    const listing = listings[0];
    const resource = listing?.resource;

    if (!resource) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Listing not found" }),
      };
    }

    const resourceUrl = `https://api.repliers.io/listings?resource=${encodeURIComponent(
      resource
    )}&resultsPerPage=1`;

    console.log("[repliers-listing-detail] Fetching listing by resource:", resource);

    const resourceResponse = await fetch(resourceUrl, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
    });

    if (!resourceResponse.ok) {
      const errorText = await resourceResponse.text().catch(() => "Unknown error");
      console.error("[repliers-listing-detail] Upstream error:", {
        status: resourceResponse.status,
        resource,
        body: errorText.substring(0, 500),
      });

      if (resourceResponse.status === 404) {
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
          status: resourceResponse.status,
        }),
      };
    }

    const responseBody = await resourceResponse.text();

    return {
      statusCode: 200,
      headers,
      body: responseBody,
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
