import { randomUUID } from "crypto";
import type { Handler } from "@netlify/functions";

import { buildCorsHeaders } from "./repliers-utils";

const FUNCTION_NAME = "repliers-diagnostics";
const UPSTREAM_URL = "https://api.repliers.io/listings?resultsPerPage=1";

const getRequestId = (headers: Record<string, string | undefined>): string => {
  return (
    headers["x-nf-request-id"] ||
    headers["x-request-id"] ||
    headers["x-requestid"] ||
    randomUUID()
  );
};

const sanitizeSnippet = (text: string, secret?: string): string => {
  let sanitized = text.replace(/[\u0000-\u001F\u007F]/g, "");
  if (secret) {
    sanitized = sanitized.split(secret).join("[redacted]");
  }
  return sanitized.slice(0, 120);
};

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin, "GET, OPTIONS");
  const headers = {
    "Content-Type": "application/json",
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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const requestId = getRequestId(event.headers);
  const adminKey = process.env.AAC_ADMIN_KEY || "";
  const providedAdminKey = event.headers["x-aac-admin"] || "";

  if (!adminKey || providedAdminKey !== adminKey) {
    console.log(JSON.stringify({
      function: FUNCTION_NAME,
      requestId,
      upstreamStatus: null,
      category: "auth",
      note: "admin key mismatch",
    }));
    return { statusCode: 404, headers, body: "" };
  }

  const apiKey = process.env.REPLIERS_API_KEY;
  const authHeaderName = process.env.REPLIERS_API_KEY_HEADER || "REPLIERS-API-KEY";
  const envPresent = {
    REPLIERS_API_KEY: Boolean(apiKey),
    REPLIERS_API_KEY_HEADER: Boolean(process.env.REPLIERS_API_KEY_HEADER),
  };

  if (!apiKey) {
    console.log(JSON.stringify({
      function: FUNCTION_NAME,
      requestId,
      upstreamStatus: null,
      category: "auth",
      note: "missing REPLIERS_API_KEY",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        requestId,
        envPresent,
        upstream: {
          urlTested: UPSTREAM_URL,
          category: "auth",
          note: "REPLIERS_API_KEY environment variable not set",
        },
      }),
    };
  }

  const authHeaderValue =
    authHeaderName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  const start = Date.now();

  try {
    const response = await fetch(UPSTREAM_URL, {
      method: "GET",
      headers: {
        [authHeaderName]: authHeaderValue,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - start;
    const upstream: {
      urlTested: string;
      status?: number;
      elapsedMs?: number;
      category?: "auth" | "network" | "timeout" | "upstream" | "unknown";
      note?: string;
    } = {
      urlTested: UPSTREAM_URL,
      status: response.status,
      elapsedMs,
    };

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      upstream.category = response.status === 401 || response.status === 403 ? "auth" : "upstream";
      if (responseText) {
        upstream.note = sanitizeSnippet(responseText, apiKey);
      }
    }

    console.log(JSON.stringify({
      function: FUNCTION_NAME,
      requestId,
      upstreamStatus: response.status,
      category: upstream.category ?? (response.ok ? "unknown" : "upstream"),
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: response.ok,
        requestId,
        envPresent,
        upstream,
      }),
    };
  } catch (error: any) {
    const elapsedMs = Date.now() - start;
    const isAbort = error?.name === "AbortError";
    const category = isAbort ? "timeout" : "network";

    console.log(JSON.stringify({
      function: FUNCTION_NAME,
      requestId,
      upstreamStatus: null,
      category,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        requestId,
        envPresent,
        upstream: {
          urlTested: UPSTREAM_URL,
          elapsedMs,
          category,
          note: isAbort ? "Upstream request timed out" : error?.message || "Network error",
        },
      }),
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
