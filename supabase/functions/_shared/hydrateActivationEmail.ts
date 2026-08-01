/**
 * Late rendering for the License Verified activation email.
 *
 * The plaintext activation token is NEVER stored in `email_jobs`. The queued
 * payload carries only `activation_token_id`; the worker re-derives the exact
 * same token from the signing secret at send time.
 *
 * Because the HMAC inputs (id, user_id, integer epoch expiry) are immutable,
 * every retry renders a byte-identical body — which is what makes the Resend
 * `Idempotency-Key` safe to use here.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildLicenseVerifiedEmailHtml } from "./buildLicenseVerifiedEmailHtml.ts";
import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";
import { activationUrl, epochSeconds, signActivationToken } from "./activationTokens.ts";

export const ACTIVATION_TEMPLATE = "license-verified";

/** Hard ceiling on retries, kept well under Resend's 24h idempotency retention. */
export const ACTIVATION_RETRY_WINDOW_MS = 12 * 60 * 60 * 1000;

const FOOTER_AGENT = {
  firstName: "Chris",
  lastName: "Tuite",
  title: "Founder",
  company: null,
  email: "chris@allagentconnect.com",
  phone: "6178770519",
  headshotUrl:
    "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/agent-headshots/1fc50da1-2664-4931-8cab-64e24dc5ed8c/headshot-1773973124574.jpg",
};

export type ActivationHydration =
  | { outcome: "ready"; html: string; providerIdempotencyKey: string }
  | { outcome: "skip"; reason: string }
  | { outcome: "error"; reason: string };

export function formatActivationExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(expiresAt));
}

export async function hydrateActivationEmail(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<ActivationHydration> {
  const tokenId = typeof payload.activation_token_id === "string"
    ? payload.activation_token_id
    : null;
  if (!tokenId) return { outcome: "error", reason: "missing activation_token_id" };

  const secret = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!secret) return { outcome: "error", reason: "ACTIVATION_TOKEN_SECRET not configured" };

  const { data: row, error } = await admin
    .from("agent_activation_tokens")
    .select("id,user_id,expires_at,status")
    .eq("id", tokenId)
    .maybeSingle();

  if (error) return { outcome: "error", reason: `token lookup failed: ${error.message}` };
  if (!row) return { outcome: "skip", reason: "activation token no longer exists" };
  if (row.status === "revoked" || row.status === "redeemed") {
    return { outcome: "skip", reason: `activation token ${row.status}` };
  }
  if (new Date(row.expires_at) <= new Date()) {
    return { outcome: "skip", reason: "activation token expired before send" };
  }

  const token = await signActivationToken(secret, {
    id: row.id,
    userId: row.user_id,
    expiresAtEpoch: epochSeconds(row.expires_at),
  });

  const html = buildLicenseVerifiedEmailHtml({
    ctaUrl: activationUrl(AAC_PUBLIC_URL, token),
    agentName: typeof payload.agent_name === "string" ? payload.agent_name : undefined,
    footerAgent: FOOTER_AGENT,
    ctaLabel: "Activate My Account",
    ctaNote: `This activation link is valid until ${formatActivationExpiry(row.expires_at)}.`,
  });

  return {
    outcome: "ready",
    html,
    // Matches the job's durable idempotency_key, so a worker retry replays the
    // identical provider request instead of creating a second message.
    providerIdempotencyKey: `license-verified/${row.id}`,
  };
}
