import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AgentDisplayProfile = {
  first_name: string;
  last_name: string;
  email: string | null;
  headshot_url: string | null;
  company: string | null;
  title: string | null;
};

type AgentProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  headshot_url?: string | null;
  company?: string | null;
  title?: string | null;
};

function mapAgentProfileRow(row: AgentProfileRow): AgentDisplayProfile {
  return {
    first_name: typeof row.first_name === "string" ? row.first_name.trim() : "",
    last_name: typeof row.last_name === "string" ? row.last_name.trim() : "",
    email: typeof row.email === "string" && row.email.trim() ? row.email.trim() : null,
    headshot_url: row.headshot_url ?? null,
    company: row.company ?? null,
    title: row.title ?? null,
  };
}

/**
 * Resolve the logged-in agent's display profile without creating rows.
 * Order: agent_profiles → profiles (auth trigger) → auth user metadata.
 */
export async function resolveAgentDisplayProfile(
  userId: string,
  authUser?: User | null,
): Promise<{ profile: AgentDisplayProfile | null; source: "agent_profiles" | "profiles" | "auth_metadata" | null }> {
  const { data: agentRow, error: agentErr } = await supabase
    .from("agent_profiles")
    .select("first_name,last_name,email,headshot_url,company,title")
    .eq("id", userId)
    .maybeSingle();

  if (agentErr) {
    console.warn("[resolveAgentDisplayProfile] agent_profiles query failed:", agentErr.message);
  }

  if (agentRow) {
    return { profile: mapAgentProfileRow(agentRow), source: "agent_profiles" };
  }

  const { data: publicRow, error: publicErr } = await supabase
    .from("profiles")
    .select("first_name,last_name,email,phone")
    .eq("id", userId)
    .maybeSingle();

  if (publicErr) {
    console.warn("[resolveAgentDisplayProfile] profiles query failed:", publicErr.message);
  }

  if (publicRow) {
    console.warn(
      "[resolveAgentDisplayProfile] Missing agent_profiles row; using profiles fallback for user",
      userId,
    );
    return {
      profile: mapAgentProfileRow({
        first_name: publicRow.first_name,
        last_name: publicRow.last_name,
        email: publicRow.email,
        headshot_url: null,
        company: null,
        title: null,
      }),
      source: "profiles",
    };
  }

  const meta = authUser?.user_metadata ?? {};
  const metaFirst =
    typeof meta.first_name === "string"
      ? meta.first_name
      : typeof meta.given_name === "string"
        ? meta.given_name
        : "";
  const metaLast =
    typeof meta.last_name === "string"
      ? meta.last_name
      : typeof meta.family_name === "string"
        ? meta.family_name
        : "";

  if (metaFirst || metaLast || authUser?.email) {
    console.warn(
      "[resolveAgentDisplayProfile] No agent_profiles or profiles row; using auth metadata for user",
      userId,
    );
    return {
      profile: {
        first_name: metaFirst.trim(),
        last_name: metaLast.trim(),
        email: authUser?.email?.trim() || null,
        headshot_url: null,
        company: null,
        title: null,
      },
      source: "auth_metadata",
    };
  }

  return { profile: null, source: null };
}
