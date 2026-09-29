/**
 * Listing → Social Media Publishing (browser side).
 *
 * The browser never talks to bundle.social and never sees the API key; it only
 * calls our Edge Functions with the user's session. Social always runs AFTER a
 * successful listing save and can never roll that save back.
 *
 * V1 rule: social is offered only when the signed-in user owns the listing
 * (the backend posts through the caller's own connected accounts).
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LISTING_STATUS } from "@/constants/status";

export const SOCIAL_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "THREADS"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialConnected = Record<SocialPlatform, boolean>;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  THREADS: "Threads",
};

/** Only these statuses block social. Off Market and Coming Soon are eligible. */
const SOCIAL_EXCLUDED_STATUSES: ReadonlySet<string> = new Set([
  LISTING_STATUS.DRAFT,
  LISTING_STATUS.TEMPORARILY_WITHDRAWN,
  LISTING_STATUS.CANCELLED,
  LISTING_STATUS.CANCELED,
]);

export function isSocialEligibleStatus(status: string | null | undefined): boolean {
  return !!status && !SOCIAL_EXCLUDED_STATUSES.has(status);
}

/** Maps a persisted listing status to the server's caption event type. */
export function statusToSocialEventType(dbStatus: string): string {
  switch (dbStatus) {
    case "active":
    case "new":
      return "just_listed";
    case "coming_soon":
    case "off_market":
    case "back_on_market":
    case "pending":
    case "under_agreement":
    case "sold":
      return dbStatus;
    default:
      return "update";
  }
}

export function newClientRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Connected state for the caller's own accounts, or null (not allowed / failed). */
export async function fetchSocialConnected(): Promise<SocialConnected | null> {
  try {
    const { data, error } = await supabase.functions.invoke("social-accounts-status", { body: {} });
    const platforms = (data as { platforms?: Record<string, boolean> } | null)?.platforms;
    if (error || !platforms) return null;
    const out = {} as SocialConnected;
    for (const p of SOCIAL_PLATFORMS) out[p] = platforms[p] === true;
    return out;
  } catch {
    return null;
  }
}

export function hasAnyConnected(c: SocialConnected | null): boolean {
  return !!c && SOCIAL_PLATFORMS.some((p) => c[p]);
}

export async function openSocialConnectPortal(returnUrl?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("social-connect-portal", {
    body: { returnUrl: returnUrl ?? `${window.location.origin}/agent/settings` },
  });
  const url = (data as { portalUrl?: string } | null)?.portalUrl;
  if (error || !url) {
    toast.error("Could not open the social connection page. Please try again.");
    return;
  }
  window.location.assign(url);
}

/** The listing's saved defaults (set on first publish), or null if none. */
export async function fetchListingSocialDefaults(listingId: string): Promise<SocialPlatform[] | null> {
  const { data } = await supabase
    .from("listing_social_defaults")
    .select("facebook, instagram, linkedin, threads")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, boolean>;
  return SOCIAL_PLATFORMS.filter((p) => row[p.toLowerCase()] === true);
}

/** Saves first-publish defaults server-side (all-false allowed). Returns success. */
export async function saveListingSocialDefaults(listingId: string, platforms: SocialPlatform[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("social-save-listing-defaults", {
      body: {
        listingId,
        facebook: platforms.includes("FACEBOOK"),
        instagram: platforms.includes("INSTAGRAM"),
        linkedin: platforms.includes("LINKEDIN"),
        threads: platforms.includes("THREADS"),
      },
    });
    return !error && (data as { ok?: boolean } | null)?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Posts one listing event and reports the result with a toast. Awaited so the
 * result is accurate; Retry re-sends the SAME clientRequestId (server dedupe).
 */
export async function publishListingSocial(args: {
  listingId: string;
  eventType: string;
  platforms: SocialPlatform[];
  clientRequestId: string;
}): Promise<boolean> {
  if (args.platforms.length === 0) return true;
  let ok = false;
  try {
    const { data, error } = await supabase.functions.invoke("social-publish-listing", {
      body: {
        listingId: args.listingId,
        eventType: args.eventType,
        platforms: args.platforms,
        clientRequestId: args.clientRequestId,
      },
    });
    ok = !error && (data as { status?: string } | null)?.status === "published";
  } catch {
    ok = false;
  }
  if (ok) {
    toast.success("Shared to social media.");
  } else {
    toast.error("Listing published, but the social post could not be completed.", {
      duration: 12000,
      action: { label: "Retry", onClick: () => void publishListingSocial(args) },
    });
  }
  return ok;
}
