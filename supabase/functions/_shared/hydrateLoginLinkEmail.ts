/**
 * Late rendering for the AAC sign-in link email.
 *
 * The plaintext login token is NEVER stored in `email_jobs`. The queued
 * payload carries only `login_token_id`; the worker re-derives the exact
 * same token from the signing secret at send time. Deterministic inputs
 * mean every retry renders a byte-identical body.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildLoginLinkEmailHtml } from "./buildLoginLinkEmailHtml.ts";
import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";
import { epochSeconds, loginLinkUrl, signLoginToken } from "./loginTokens.ts";

export const LOGIN_LINK_TEMPLATE = "agent-login-link";

/** Kept under Resend's 24h idempotency retention. */
export const LOGIN_LINK_RETRY_WINDOW_MS = 12 * 60 * 60 * 1000;

export type LoginLinkHydration =
  | { outcome: "ready"; html: string; providerIdempotencyKey: string }
  | { outcome: "skip"; reason: string }
  | { outcome: "error"; reason: string };

export function formatLoginLinkExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(expiresAt));
}

export async function hydrateLoginLinkEmail(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<LoginLinkHydration> {
  const tokenId = typeof payload.login_token_id === "string" ? payload.login_token_id : null;
  if (!tokenId) return { outcome: "error", reason: "missing login_token_id" };

  const secret = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!secret) return { outcome: "error", reason: "ACTIVATION_TOKEN_SECRET not configured" };

  const { data: row, error } = await admin
    .from("agent_login_tokens")
    .select("id,user_id,expires_at,status")
    .eq("id", tokenId)
    .maybeSingle();

  if (error) return { outcome: "error", reason: `token lookup failed: ${error.message}` };
  if (!row) return { outcome: "skip", reason: "login token no longer exists" };
  if (row.status === "revoked" || row.status === "redeemed") {
    return { outcome: "skip", reason: `login token ${row.status}` };
  }
  if (new Date(row.expires_at) <= new Date()) {
    return { outcome: "skip", reason: "login token expired before send" };
  }

  const token = await signLoginToken(secret, {
    id: row.id,
    userId: row.user_id,
    expiresAtEpoch: epochSeconds(row.expires_at),
  });

  const html = buildLoginLinkEmailHtml({
    ctaUrl: loginLinkUrl(AAC_PUBLIC_URL, token),
    agentName: typeof payload.agent_name === "string" ? payload.agent_name : undefined,
    expiresLabel: formatLoginLinkExpiry(row.expires_at),
  });

  return {
    outcome: "ready",
    html,
    providerIdempotencyKey: `agent-login-link/${row.id}`,
  };
}
