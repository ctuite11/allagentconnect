/**
 * Late rendering for the concierge "we prepared this listing for you" email.
 *
 * Same contract as the activation / sign-in link emails: the plaintext token is
 * NEVER stored in `email_jobs`. The queued payload carries only the token id and
 * kind; the worker re-derives the token from the signing secret at send time, so
 * every retry renders a byte-identical body.
 *
 * Token kind follows AAC's existing split, by activation state:
 *   not activated -> activation/setup token -> /activate#t=...
 *   activated     -> login token            -> /signin-link#t=...
 *
 * The buttons are navigation only. Opening or scanning them does not redeem the
 * token (it stays in the URL fragment) and can never publish a listing.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildConciergeReviewEmailHtml } from "./buildConciergeReviewEmailHtml.ts";
import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";
import { activationUrl, epochSeconds, signActivationToken } from "./activationTokens.ts";
import { loginLinkUrl, signLoginToken } from "./loginTokens.ts";
import { resolveEmailPhotoUrl } from "./listingPhotoUrl.ts";

export const CONCIERGE_REVIEW_TEMPLATE = "concierge-listing-review";

/** Kept under Resend's 24h idempotency retention. */
export const CONCIERGE_REVIEW_RETRY_WINDOW_MS = 12 * 60 * 60 * 1000;

export type ConciergeReviewHydration =
  | { outcome: "ready"; html: string; providerIdempotencyKey: string }
  | { outcome: "skip"; reason: string }
  | { outcome: "error"; reason: string };

export function conciergeReviewPath(listingId: string): string {
  return `/agent/listings/review/${listingId}`;
}

export function conciergeEditPath(listingId: string): string {
  return `/agent/listings/edit/${listingId}`;
}

function withReturnTo(url: string, path: string): string {
  return `${url}&r=${encodeURIComponent(path)}`;
}

function formatExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(expiresAt));
}

function priceLabel(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return "Price to be confirmed";
  return `$${Math.round(num).toLocaleString()}`;
}

function numeric(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function titleCase(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function hydrateConciergeReviewEmail(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<ConciergeReviewHydration> {
  const tokenId = typeof payload.access_token_id === "string" ? payload.access_token_id : null;
  const tokenKind = payload.access_token_kind === "activation" ? "activation" : "login";
  const listingId = typeof payload.listing_id === "string" ? payload.listing_id : null;

  if (!tokenId) return { outcome: "error", reason: "missing access_token_id" };
  if (!listingId) return { outcome: "error", reason: "missing listing_id" };

  const secret = Deno.env.get("ACTIVATION_TOKEN_SECRET");
  if (!secret) return { outcome: "error", reason: "ACTIVATION_TOKEN_SECRET not configured" };

  const table = tokenKind === "activation" ? "agent_activation_tokens" : "agent_login_tokens";
  const { data: row, error } = await admin
    .from(table)
    .select("id,user_id,expires_at,status")
    .eq("id", tokenId)
    .maybeSingle();

  if (error) return { outcome: "error", reason: `token lookup failed: ${error.message}` };
  if (!row) return { outcome: "skip", reason: `${tokenKind} token no longer exists` };
  if (row.status === "revoked" || row.status === "redeemed") {
    return { outcome: "skip", reason: `${tokenKind} token ${row.status}` };
  }
  if (new Date(row.expires_at) <= new Date()) {
    return { outcome: "skip", reason: `${tokenKind} token expired before send` };
  }

  const { data: listing, error: listingErr } = await admin
    .from("listings")
    .select(
      "id, agent_id, status, address, unit_number, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, photos",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) return { outcome: "error", reason: `listing lookup failed: ${listingErr.message}` };
  if (!listing) return { outcome: "skip", reason: "listing no longer exists" };
  if (listing.agent_id !== row.user_id) {
    return { outcome: "skip", reason: "listing no longer belongs to the recipient" };
  }

  const plaintext = tokenKind === "activation"
    ? await signActivationToken(secret, {
      id: row.id,
      userId: row.user_id,
      expiresAtEpoch: epochSeconds(row.expires_at),
    })
    : await signLoginToken(secret, {
      id: row.id,
      userId: row.user_id,
      expiresAtEpoch: epochSeconds(row.expires_at),
    });

  const baseUrl = tokenKind === "activation"
    ? activationUrl(AAC_PUBLIC_URL, plaintext)
    : loginLinkUrl(AAC_PUBLIC_URL, plaintext);

  const street = [listing.address, listing.unit_number ? `Unit ${listing.unit_number}` : null]
    .filter(Boolean)
    .join(", ");
  const cityLine = [listing.city, [listing.state, listing.zip_code].filter(Boolean).join(" ")]
    .filter((part) => part && String(part).trim())
    .join(", ");

  const html = buildConciergeReviewEmailHtml({
    agentName: typeof payload.agent_name === "string" ? payload.agent_name : undefined,
    addressLine: street || "Your new listing",
    cityLine: cityLine || null,
    priceLabel: priceLabel(listing.price),
    statusLabel: "Draft — ready for your review",
    photoUrl: resolveEmailPhotoUrl(listing.photos) || null,
    beds: numeric(listing.bedrooms),
    baths: numeric(listing.bathrooms),
    sqft: numeric(listing.square_feet),
    propertyType: titleCase(listing.property_type),
    description: typeof listing.description === "string" ? listing.description : null,
    reviewUrl: withReturnTo(baseUrl, conciergeReviewPath(listing.id)),
    editUrl: withReturnTo(baseUrl, conciergeEditPath(listing.id)),
    expiresLabel: formatExpiry(row.expires_at),
  });

  return {
    outcome: "ready",
    html,
    providerIdempotencyKey: `${CONCIERGE_REVIEW_TEMPLATE}/${row.id}`,
  };
}
