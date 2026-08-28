import { supabase } from "@/integrations/supabase/client";

export interface AgentEmailMatch {
  source: "account" | "invite" | "early_access" | "pending_verification" | "deleted";
  label: string;
  detail?: string | null;
  status?: string | null;
  date?: string | null;
}

export interface AgentNameMatch {
  source: "account" | "early_access" | "pending_verification" | "deleted";
  sourceLabel: string;
  name: string;
  email?: string | null;
  status?: string | null;
  brokerage?: string | null;
  date?: string | null;
}

export interface AgentEmailCheck {
  email: string;
  found: boolean;
  hasActiveAccount: boolean;
  matches: AgentEmailMatch[];
  /** Exact normalized first+last name hits. Advisory only — never blocking. */
  nameMatches?: AgentNameMatch[];
}

/**
 * Admin-only advisory lookup: is this email already known to AAC?
 * Fails open (returns null) — admin-create-user remains authoritative.
 */
export async function checkAgentEmail(
  email: string,
  firstName?: string,
  lastName?: string,
): Promise<AgentEmailCheck | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const lookup = supabase.functions.invoke("admin-check-agent-email", {
      body: {
        email: normalized,
        firstName: (firstName ?? "").trim(),
        lastName: (lastName ?? "").trim(),
      },
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    const result = await Promise.race([lookup, timeout]);
    if (!result) return null;
    const { data, error } = result;
    if (error) {
      console.warn("[checkAgentEmail] lookup error:", error);
      return null;
    }
    return (data ?? null) as AgentEmailCheck | null;
  } catch (err) {
    console.warn("[checkAgentEmail] threw:", err);
    return null;
  }
}

export function formatMatchLine(match: AgentEmailMatch): string {
  const parts: string[] = [match.label];
  if (match.detail) parts.push(match.detail);
  if (match.status) parts.push(match.status);
  if (match.date) {
    const d = new Date(match.date);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      );
    }
  }
  return parts.join(" — ");
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One readable line for a name match: source, email, status, brokerage, date. */
export function formatNameMatchLine(match: AgentNameMatch): string {
  const parts: string[] = [match.sourceLabel];
  if (match.email) parts.push(match.email);
  if (match.status) parts.push(match.status);
  if (match.brokerage) parts.push(match.brokerage);
  const d = formatDate(match.date);
  if (d) parts.push(d);
  return parts.join(" — ");
}
