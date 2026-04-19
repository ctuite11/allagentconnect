import type { Handler } from "@netlify/functions";

import { readAttomApiKey, testAttomConnectivity } from "./attom-client";
import { buildCorsHeaders } from "./repliers-utils";

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin, "GET, OPTIONS");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...cors.headers,
  };

  if (cors.isBrowserRequest && !cors.isAllowedOrigin) {
    return { statusCode: 403, headers, body: "" };
  }

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const apiKey = readAttomApiKey();
    const query = event.queryStringParameters || {};
    const result = await testAttomConnectivity(apiKey, {
      address: query.address,
      city: query.city,
      state: query.state,
      zip: query.zip,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: result.ok,
        status: result.status,
        envConfigured: true,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        envConfigured: false,
        error: error?.message || "ATTOM connectivity test failed",
      }),
    };
  }
};
