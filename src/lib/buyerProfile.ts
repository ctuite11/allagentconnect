import { supabase } from "@/integrations/supabase/client";

export type BuyerProfileFields = {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

/** Update `profiles` for a buyer, or insert one row if missing (no duplicate ids). */
export async function upsertBuyerProfile(fields: BuyerProfileFields): Promise<{ error: Error | null }> {
  const userId = fields.userId;
  const email = fields.email.trim().toLowerCase();
  if (!userId || !email) {
    return { error: new Error("User id and email are required.") };
  }

  const payload = {
    first_name: fields.firstName?.trim() || null,
    last_name: fields.lastName?.trim() || null,
    phone: fields.phone?.trim() || null,
    email,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    return { error: readError };
  }

  if (existing?.id) {
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    return { error: error ?? null };
  }

  const { error } = await supabase.from("profiles").insert([{ id: userId, ...payload }]);
  return { error: error ?? null };
}

function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Title-case each name part so `brody tuite` → `Brody Tuite`. */
export function formatBuyerDisplayName(raw: string): string {
  const formatted = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
  return formatted || "Unnamed Client";
}

export function displayNameFromProfile(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  emailFallback?: string | null,
): string {
  const display = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
  return display || emailFallback?.trim() || "";
}

export type BuyerSenderProfile = {
  name: string;
  email: string;
  phone: string;
};

/** Sender fields for buyer-side listing share (profiles + auth session fallbacks). */
export async function fetchBuyerSenderProfile(): Promise<BuyerSenderProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const name =
    displayNameFromProfile(profile?.first_name, profile?.last_name, metadataName || user.email) ||
    metadataName ||
    user.email?.split("@")[0] ||
    "";

  return {
    name,
    email: profile?.email?.trim() || user.email || "",
    phone: profile?.phone?.trim() || "",
  };
}

export function profileInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  emailFallback?: string | null,
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first && first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first) return first[0]!.toUpperCase();
  const email = emailFallback?.trim();
  if (email) return email[0]!.toUpperCase();
  return "?";
}
