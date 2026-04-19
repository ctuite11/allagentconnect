import type { Handler } from "@netlify/functions";

import { fetchAttomEnrichment, readAttomApiKey } from "./attom-client";
import { buildCorsHeaders } from "./repliers-utils";

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin, "GET, POST, OPTIONS");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=600, stale-while-revalidate=1800",
    ...cors.headers,
  };

  if (cors.isBrowserRequest && !cors.isAllowedOrigin) {
    return { statusCode: 403, headers, body: "" };
  }

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  try {
    const apiKey = readAttomApiKey();

    const query = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    const lookup = {
      attomId: body.attomId ?? query.attomId ?? null,
      address: body.address ?? query.address ?? null,
      city: body.city ?? query.city ?? null,
      state: body.state ?? query.state ?? null,
      zip: body.zip ?? query.zip ?? null,
    };

    if (!lookup.attomId && !lookup.address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "attomId or address is required",
        }),
      };
    }

    const enrichment = await fetchAttomEnrichment(lookup, apiKey);

    if (!enrichment) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: null,
          source: "fallback",
          reason: "no_attom_match",
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: enrichment,
        source: "attom",
      }),
    };
  } catch (error: any) {
    console.error("[attom-property-enrichment] Error:", error?.message || error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: null,
        source: "fallback",
        reason: "attom_error",
      }),
    };
  }
};
