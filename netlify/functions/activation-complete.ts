/**
 * Same-origin JSON proxy for the explicit activation submission.
 *
 * The activation token and the chosen password travel in the request BODY
 * only — never a URL, never a cookie, never a log line. Nothing in this file
 * logs the request body.
 */
import type { Handler } from "@netlify/functions";
import {
  callActivationFunction,
  clearResendCookieHeader,
  isSameOriginRequest,
  jsonResponse,
  resendCookie,
} from "./activation-preview";

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { status: "method_not_allowed" });
  if (!isSameOriginRequest(event)) {
    return { statusCode: 403, headers: { "Cache-Control": "no-store" }, body: "Forbidden" };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(
      event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : (event.body ?? "{}"),
    );
  } catch {
    return jsonResponse(400, { status: "invalid" });
  }

  const payload = await callActivationFunction("activation-complete", {
    token: typeof body.token === "string" ? body.token : "",
    firstName: typeof body.firstName === "string" ? body.firstName : "",
    lastName: typeof body.lastName === "string" ? body.lastName : "",
    company: typeof body.company === "string" ? body.company : "",
    password: typeof body.password === "string" ? body.password : "",
  });
  if (!payload) return jsonResponse(500, { status: "error" });

  const { resendHandle, ...safe } = payload as { resendHandle?: string | null };
  const status = typeof safe.status === "string" ? safe.status : "error";

  if (status === "ok") {
    // Success burns any outstanding resend handle.
    return jsonResponse(200, safe as Record<string, unknown>, clearResendCookieHeader());
  }
  return jsonResponse(
    200,
    safe as Record<string, unknown>,
    typeof resendHandle === "string" && resendHandle ? resendCookie(resendHandle) : undefined,
  );
};

export { handler };
