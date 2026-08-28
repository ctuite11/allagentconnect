import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findDeletedAgent } from "../_shared/checkDeletedAgent.ts";

/**
 * Admin-only pre-check used by the Create Agent dialog. Given an email, it
 * reports every place in AAC that email is already known: an existing
 * account (auth.users + profiles collapsed into one result), prior invites,
 * early-access requests, pending verification applications, and deletion
 * tombstones.
 *
 * Read-only. No mutations, no email. Mirrors the check-deleted-agent
 * security pattern (authenticated caller + has_role admin gate, service-role
 * client used only for the reads).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface EmailMatch {
  source: "account" | "invite" | "early_access" | "pending_verification" | "deleted";
  label: string;
  detail?: string | null;
  status?: string | null;
  date?: string | null;
}

/**
 * Exact-normalized name match (warning only — never blocking).
 * Email remains the only authoritative duplicate identifier.
 */
interface NameMatch {
  source: "account" | "early_access" | "pending_verification" | "deleted";
  sourceLabel: string;
  name: string;
  email: string | null;
  status: string | null;
  brokerage: string | null;
  date: string | null;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json(401, { error: "Authorization required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !caller) return json(401, { error: "Invalid session" });

  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (roleErr) {
    console.error("[admin-check-agent-email] role check error:", roleErr.message);
    return json(500, { error: "Failed to verify admin role" });
  }
  if (isAdmin !== true) return json(403, { error: "Admin access required" });

  let rawEmail: string | null = null;
  let rawFirst: string | null = null;
  let rawLast: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.email === "string") rawEmail = body.email;
    if (typeof body?.firstName === "string") rawFirst = body.firstName;
    if (typeof body?.lastName === "string") rawLast = body.lastName;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return json(400, { error: "email is required" });
  const firstNorm = normalizeName(rawFirst);
  const lastNorm = normalizeName(rawLast);


  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const matches: EmailMatch[] = [];

  /* ---- Existing account (auth.users + profiles collapsed) ---- */
  let accountUserId: string | null = null;
  let accountDeactivated = false;
  try {
    const { data: authExists } = await admin.rpc("auth_user_exists_by_email", {
      p_email: email,
    });
    const { data: profileRow } = await admin
      .from("profiles")
      .select("id, first_name, last_name, deactivated_at")
      .ilike("email", email)
      .maybeSingle();

    if (profileRow?.id) {
      accountUserId = profileRow.id as string;
      accountDeactivated = Boolean(profileRow.deactivated_at);
    }

    if (authExists === true || profileRow) {
      let agentStatus: string | null = null;
      if (accountUserId) {
        const { data: settings } = await admin
          .from("agent_settings")
          .select("agent_status")
          .eq("user_id", accountUserId)
          .maybeSingle();
        agentStatus = (settings?.agent_status as string | null) ?? null;
      }
      const name = [profileRow?.first_name, profileRow?.last_name]
        .filter((p) => typeof p === "string" && p.trim())
        .join(" ")
        .trim();
      matches.push({
        source: "account",
        label: "Already has an account",
        detail: name || null,
        status: accountDeactivated
          ? `deactivated${agentStatus ? ` · agent status: ${agentStatus}` : ""}`
          : agentStatus
          ? `agent status: ${agentStatus}`
          : null,
        date: null,
      });
    }
  } catch (err) {
    console.error("[admin-check-agent-email] account lookup failed:", err);
  }

  /* ---- Prior invites ---- */
  try {
    const { data: invites } = await admin
      .from("agent_invites")
      .select("created_at, status, inviter_user_id")
      .ilike("invitee_email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    const invite = invites?.[0];
    if (invite) {
      let inviter: string | null = null;
      if (invite.inviter_user_id) {
        const { data: inviterProfile } = await admin
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", invite.inviter_user_id)
          .maybeSingle();
        inviter = inviterProfile
          ? [inviterProfile.first_name, inviterProfile.last_name]
              .filter((p) => typeof p === "string" && p.trim())
              .join(" ")
              .trim() || (inviterProfile.email as string | null)
          : null;
      }
      matches.push({
        source: "invite",
        label: "Invited before",
        detail: inviter ? `by ${inviter}` : null,
        status: (invite.status as string | null) ?? null,
        date: (invite.created_at as string | null) ?? null,
      });
    }
  } catch (err) {
    console.error("[admin-check-agent-email] invite lookup failed:", err);
  }

  /* ---- Early access requests ---- */
  try {
    const { data: rows } = await admin
      .from("agent_early_access")
      .select("created_at, status, brokerage")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (row) {
      matches.push({
        source: "early_access",
        label: "Requested early access",
        detail: (row.brokerage as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        date: (row.created_at as string | null) ?? null,
      });
    }
  } catch (err) {
    console.error("[admin-check-agent-email] early access lookup failed:", err);
  }

  /* ---- Pending verification applications ---- */
  try {
    const { data: rows } = await admin
      .from("pending_verifications")
      .select("created_at, status, processed, company")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (row) {
      matches.push({
        source: "pending_verification",
        label: "Verification application on file",
        detail: (row.company as string | null) ?? null,
        status: (row.status as string | null) ?? (row.processed ? "processed" : "pending"),
        date: (row.created_at as string | null) ?? null,
      });
    }
  } catch (err) {
    console.error("[admin-check-agent-email] pending verification lookup failed:", err);
  }

  /* ---- Deletion tombstone (visibility only — existing flow unchanged) ---- */
  const deletedMatch = await findDeletedAgent(admin, email);
  if (deletedMatch) {
    matches.push({
      source: "deleted",
      label: "Previously deleted agent",
      detail: [deletedMatch.first_name, deletedMatch.last_name]
        .filter((p) => typeof p === "string" && p.trim())
        .join(" ")
        .trim() || null,
      status: deletedMatch.deletion_reason ?? null,
      date: deletedMatch.deleted_at ?? null,
    });
  }

  // Blocking only when there is a live (non-deleted) registered account.
  const hasActiveAccount = matches.some((m) => m.source === "account") &&
    !(deletedMatch && !accountUserId);

  return json(200, {
    email,
    found: matches.length > 0,
    hasActiveAccount,
    matches,
  });
});
