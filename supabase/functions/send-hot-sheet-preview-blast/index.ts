/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import {
  buildHotSheetPreviewEmailHtml,
  HOT_SHEET_PREVIEW_BLAST_SUBJECT,
  HOT_SHEET_PREVIEW_CTA_URL,
} from "../_shared/buildHotSheetPreviewEmailHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Featured Somerville listing for the preview card. */
const FEATURED_LISTING_ID = "ce892c22-6e2b-4d7a-a649-2e2b8a8f95a5";
const CAMPAIGN_DATE = "2026-07-06";
const IDEMPOTENCY_PREFIX = `hotsheet-preview-blast-${CAMPAIGN_DATE}-`;

type RequestBody = {
  dryRun?: boolean;
  /** Send a single preview to this address only — does not queue the full blast. */
  testEmail?: string;
};

type AgentProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  headshot_url: string | null;
  bio: string | null;
  company: string | null;
};

type AgentSettingsRow = {
  user_id: string;
  preferences_set: boolean | null;
};

type EligibleRecipient = {
  agentId: string;
  email: string;
  firstName: string;
  profileIncomplete: boolean;
  preferencesIncomplete: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isBlank(value: string | null | undefined): boolean {
  return !value || !String(value).trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function displayFirstName(profile: AgentProfileRow): string {
  return profile.first_name?.trim() || "there";
}

async function assertAdminOrServiceRole(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseServiceKey: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, status: 401, error: "Authorization required" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401, error: "Authorization required" };
  }

  if (token === supabaseServiceKey) {
    return { ok: true };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, status: 401, error: "Invalid session" };
  }

  const { data: isAdmin } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (isAdmin !== true) {
    return { ok: false, status: 403, error: "Admin or service-role access required" };
  }

  return { ok: true };
}

async function isRecipientSuppressed(
  admin: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const checks = await Promise.all(
    (["marketing", "hot_sheet_alerts"] as const).map(async (category) => {
      const { data } = await admin.rpc("is_email_unsubscribed", {
        _email: normalized,
        _category: category,
      });
      return data === true;
    }),
  );
  return checks.some(Boolean);
}

async function loadAlreadyQueuedAgentIds(admin: SupabaseClient): Promise<Set<string>> {
  const queued = new Set<string>();
  const { data: rows } = await admin
    .from("email_jobs")
    .select("idempotency_key")
    .like("idempotency_key", `${IDEMPOTENCY_PREFIX}%`);

  for (const row of rows ?? []) {
    const key = row.idempotency_key as string | null;
    if (!key?.startsWith(IDEMPOTENCY_PREFIX)) continue;
    const agentId = key.slice(IDEMPOTENCY_PREFIX.length);
    if (agentId) queued.add(agentId);
  }

  return queued;
}

async function resolveEligibleRecipients(admin: SupabaseClient): Promise<{
  totalVerifiedAgents: number;
  profileIncompleteCount: number;
  preferencesIncompleteCount: number;
  eligible: EligibleRecipient[];
}> {
  const { data: agentRoles, error: rolesError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "agent");

  if (rolesError) throw rolesError;

  const agentIds = (agentRoles ?? []).map((r) => r.user_id as string);
  if (agentIds.length === 0) {
    return {
      totalVerifiedAgents: 0,
      profileIncompleteCount: 0,
      preferencesIncompleteCount: 0,
      eligible: [],
    };
  }

  const { data: verifiedSettings, error: settingsError } = await admin
    .from("agent_settings")
    .select("user_id, preferences_set")
    .in("user_id", agentIds)
    .eq("agent_status", "verified");

  if (settingsError) throw settingsError;

  const settingsRows = (verifiedSettings ?? []) as AgentSettingsRow[];
  const verifiedIds = settingsRows.map((s) => s.user_id);
  const totalVerifiedAgents = verifiedIds.length;

  if (verifiedIds.length === 0) {
    return {
      totalVerifiedAgents: 0,
      profileIncompleteCount: 0,
      preferencesIncompleteCount: 0,
      eligible: [],
    };
  }

  const settingsByUser = new Map(settingsRows.map((s) => [s.user_id, s]));

  const { data: profiles, error: profilesError } = await admin
    .from("agent_profiles")
    .select("id, email, first_name, last_name, headshot_url, bio, company")
    .in("id", verifiedIds);

  if (profilesError) throw profilesError;

  const { data: coverageRows, error: coverageError } = await admin
    .from("agent_buyer_coverage_areas")
    .select("agent_id")
    .eq("source", "notifications")
    .in("agent_id", verifiedIds);

  if (coverageError) throw coverageError;

  const coverageCountByAgent = new Map<string, number>();
  for (const row of coverageRows ?? []) {
    const agentId = row.agent_id as string;
    coverageCountByAgent.set(agentId, (coverageCountByAgent.get(agentId) ?? 0) + 1);
  }

  let profileIncompleteCount = 0;
  let preferencesIncompleteCount = 0;
  const eligibleMap = new Map<string, EligibleRecipient>();

  for (const profile of (profiles ?? []) as AgentProfileRow[]) {
    const settings = settingsByUser.get(profile.id);
    if (!settings) continue;

    const email = profile.email?.trim().toLowerCase() ?? "";
    if (!email) continue;

    const coverageCount = coverageCountByAgent.get(profile.id) ?? 0;
    const profileIncomplete =
      isBlank(profile.headshot_url) || isBlank(profile.bio) || isBlank(profile.company);
    const preferencesIncomplete =
      settings.preferences_set !== true && coverageCount === 0;

    if (profileIncomplete) profileIncompleteCount++;
    if (preferencesIncomplete) preferencesIncompleteCount++;

    if (!profileIncomplete && !preferencesIncomplete) continue;

    eligibleMap.set(profile.id, {
      agentId: profile.id,
      email,
      firstName: displayFirstName(profile),
      profileIncomplete,
      preferencesIncomplete,
    });
  }

  return {
    totalVerifiedAgents,
    profileIncompleteCount,
    preferencesIncompleteCount,
    eligible: Array.from(eligibleMap.values()),
  };
}

async function kickEmailQueue(supabaseUrl: string, serviceRoleKey: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch (err) {
    console.warn("[send-hot-sheet-preview-blast] kick-email-queue failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = await assertAdminOrServiceRole(
    req,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
  );
  if (!auth.ok) {
    return json({ success: false, error: auth.error }, auth.status);
  }

  let body: RequestBody = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as RequestBody;
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  // Default dry run — live queue requires explicit opt-in.
  const dryRun = body.dryRun !== false;
  const testEmail = body.testEmail?.trim().toLowerCase() ?? "";

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("*")
      .eq("id", FEATURED_LISTING_ID)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) {
      return json({
        success: false,
        error: `Featured listing not found: ${FEATURED_LISTING_ID}`,
      }, 404);
    }

    const baseUrl = resolveEmailBaseUrl(Deno.env.get("EMAIL_BASE_URL"));

    if (testEmail) {
      if (!isValidEmail(testEmail)) {
        return json({ success: false, error: "Invalid testEmail address" }, 400);
      }

      const html = buildHotSheetPreviewEmailHtml({
        userName: "Chris",
        listing,
        baseUrl,
        ctaUrl: HOT_SHEET_PREVIEW_CTA_URL,
      });

      const idempotencyKey = `${IDEMPOTENCY_PREFIX}test-${testEmail.replace(/[^a-z0-9@._-]/g, "-")}-${Date.now()}`;
      const { error: insertError } = await admin.from("email_jobs").insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "hot-sheet-preview-blast-test",
          to: testEmail,
          subject: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
          html,
          category: "marketing",
        },
      });

      if (insertError) {
        return json({
          success: false,
          error: insertError.message,
          testEmail,
        }, 500);
      }

      await kickEmailQueue(supabaseUrl, supabaseServiceKey);

      return json({
        success: true,
        testEmail,
        queuedCount: 1,
        dryRun: false,
        message: `Test Hot Sheet preview queued for ${testEmail}`,
      });
    }

    const {
      totalVerifiedAgents,
      profileIncompleteCount,
      preferencesIncompleteCount,
      eligible,
    } = await resolveEligibleRecipients(admin);

    const eligibleUnionCount = eligible.length;
    const alreadyQueued = await loadAlreadyQueuedAgentIds(admin);

    const skipReasons: Record<string, number> = {
      invalid_email: 0,
      suppressed: 0,
      already_queued: 0,
    };

    const toQueue: EligibleRecipient[] = [];

    for (const recipient of eligible) {
      if (!isValidEmail(recipient.email)) {
        skipReasons.invalid_email++;
        continue;
      }
      if (await isRecipientSuppressed(admin, recipient.email)) {
        skipReasons.suppressed++;
        continue;
      }
      if (alreadyQueued.has(recipient.agentId)) {
        skipReasons.already_queued++;
        continue;
      }
      toQueue.push(recipient);
    }

    const skippedCount =
      skipReasons.invalid_email + skipReasons.suppressed + skipReasons.already_queued;
    const finalRecipientCount = toQueue.length;

    if (dryRun) {
      const sampleRecipients = toQueue.slice(0, 15).map((r) => ({
        agentId: r.agentId,
        email: r.email,
        firstName: r.firstName,
        profileIncomplete: r.profileIncomplete,
        preferencesIncomplete: r.preferencesIncomplete,
        reasons: [
          r.profileIncomplete ? "profile_incomplete" : null,
          r.preferencesIncomplete ? "preferences_incomplete" : null,
        ].filter(Boolean),
      }));

      return json({
        success: true,
        dryRun: true,
        featuredListingId: FEATURED_LISTING_ID,
        totalVerifiedAgents,
        profileIncompleteCount,
        preferencesIncompleteCount,
        eligibleUnionCount,
        queuedCount: 0,
        skippedCount,
        skipReasons,
        finalRecipientCount,
        sampleRecipients,
      });
    }

    let queuedCount = 0;
    const insertErrors: string[] = [];

    for (const recipient of toQueue) {
      const html = buildHotSheetPreviewEmailHtml({
        userName: recipient.firstName,
        listing,
        baseUrl,
        ctaUrl: HOT_SHEET_PREVIEW_CTA_URL,
      });

      const idempotencyKey = `${IDEMPOTENCY_PREFIX}${recipient.agentId}`;
      const { error: insertError } = await admin.from("email_jobs").insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "hot-sheet-preview-blast",
          to: recipient.email,
          subject: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
          html,
          category: "marketing",
        },
      });

      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          skipReasons.already_queued++;
          continue;
        }
        insertErrors.push(`${recipient.email}: ${insertError.message}`);
        continue;
      }

      queuedCount++;
    }

    if (queuedCount > 0) {
      await kickEmailQueue(supabaseUrl, supabaseServiceKey);
    }

    return json({
      success: insertErrors.length === 0,
      dryRun: false,
      featuredListingId: FEATURED_LISTING_ID,
      totalVerifiedAgents,
      profileIncompleteCount,
      preferencesIncompleteCount,
      eligibleUnionCount,
      queuedCount,
      skippedCount: skippedCount + (toQueue.length - queuedCount - insertErrors.length),
      skipReasons,
      finalRecipientCount,
      insertErrors: insertErrors.length ? insertErrors.slice(0, 20) : undefined,
    });
  } catch (err) {
    console.error("[send-hot-sheet-preview-blast] error:", err);
    return json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, 500);
  }
});
