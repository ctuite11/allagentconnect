// Admin-only blast: enqueue blurred Hot Sheet preview emails for verified
// agents who have not completed profile or market preferences. All sends
// route through the existing email_jobs → process-email-queue pipeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  buildHotSheetPreviewEmailHtml,
  HOT_SHEET_PREVIEW_BLAST_SUBJECT,
} from "../_shared/buildHotSheetPreviewEmailHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEATURED_LISTING_ID = "ce892c22-6e2b-4d7a-a649-2e2b8a8f95a5";
const CAMPAIGN_DATE_TAG = "2026-07-06";
const CTA_URL = "https://allagentconnect.com/agent-settings";
const CATEGORY = "hot_sheet_alerts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const head = user.slice(0, 1) || "*";
  return `${head}***@${domain}`;
}

function extractFirstPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos)) return null;
  for (const p of photos) {
    if (typeof p === "string" && p) return p;
    if (p && typeof p === "object") {
      const obj = p as Record<string, unknown>;
      for (const k of ["url", "publicUrl", "public_url", "src"]) {
        const v = obj[k];
        if (typeof v === "string" && v) return v;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ---- Auth gate: admin JWT OR service-role bearer ----
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "Authorization required" });
  }
  const token = authHeader.slice(7).trim();

  let authorized = false;
  if (token === SERVICE_KEY) {
    authorized = true;
  } else {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: isAdmin } = await userClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      authorized = isAdmin === true;
    }
  }
  if (!authorized) return json(403, { error: "Admin access required" });

  // ---- Body ----
  let body: {
    dryRun?: boolean;
    limit?: number;
    testEmails?: string[];
    testEmail?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.floor(body.limit)
      : null;
  const rawTestEmails: string[] = [];
  if (typeof body.testEmail === "string") rawTestEmails.push(body.testEmail);
  if (Array.isArray(body.testEmails)) {
    for (const e of body.testEmails) {
      if (typeof e === "string") rawTestEmails.push(e);
    }
  }
  const testEmails = rawTestEmails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
  const testMode = testEmails.length > 0;
  // For a testEmail send, default to live-queue (dryRun=false) unless the
  // caller explicitly asked for dryRun. For a non-test invocation, default
  // to dryRun=true (safe default) unless explicitly false.
  const dryRun = testMode
    ? body.dryRun === true
    : body.dryRun !== false;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- Featured listing ----
  const { data: listing, error: listingErr } = await admin
    .from("listings")
    .select(
      "id,address,city,state,price,bedrooms,bathrooms,square_feet,photos,property_type",
    )
    .eq("id", FEATURED_LISTING_ID)
    .maybeSingle();

  if (listingErr || !listing) {
    return json(500, { error: "Featured listing not found", details: listingErr?.message });
  }

  const previewListing = {
    address: listing.address ?? "",
    city: listing.city,
    state: listing.state,
    price: listing.price as number | null,
    bedrooms: listing.bedrooms as number | null,
    bathrooms: listing.bathrooms as number | null,
    square_feet: listing.square_feet as number | null,
    property_type: listing.property_type as string | null,
    photoUrl: extractFirstPhotoUrl(listing.photos),
  };

  // ---- Recipient computation ----
  // Verified agent user_ids
  const { data: verified, error: vErr } = await admin
    .from("agent_settings")
    .select("user_id, preferences_set")
    .eq("agent_status", "verified");
  if (vErr) return json(500, { error: "Failed to load verified agents", details: vErr.message });

  const verifiedIds = (verified ?? []).map((r) => r.user_id as string);
  const totalVerifiedAgents = verifiedIds.length;
  const prefSetById = new Map<string, boolean>();
  for (const r of verified ?? []) {
    prefSetById.set(r.user_id as string, r.preferences_set === true);
  }

  // Profiles for these agents
  const profileById = new Map<string, {
    email: string | null;
    first_name: string | null;
    headshot_url: string | null;
    bio: string | null;
    company: string | null;
  }>();
  {
    const CHUNK = 500;
    for (let i = 0; i < verifiedIds.length; i += CHUNK) {
      const slice = verifiedIds.slice(i, i + CHUNK);
      const { data, error } = await admin
        .from("agent_profiles")
        .select("id,email,first_name,headshot_url,bio,company")
        .in("id", slice);
      if (error) return json(500, { error: "Failed to load profiles", details: error.message });
      for (const p of data ?? []) {
        profileById.set(p.id as string, {
          email: (p.email as string | null) ?? null,
          first_name: (p.first_name as string | null) ?? null,
          headshot_url: (p.headshot_url as string | null) ?? null,
          bio: (p.bio as string | null) ?? null,
          company: (p.company as string | null) ?? null,
        });
      }
    }
  }

  // Coverage-area counts
  const coverageCountById = new Map<string, number>();
  {
    const CHUNK = 500;
    for (let i = 0; i < verifiedIds.length; i += CHUNK) {
      const slice = verifiedIds.slice(i, i + CHUNK);
      const { data, error } = await admin
        .from("agent_buyer_coverage_areas")
        .select("agent_id")
        .in("agent_id", slice);
      if (error) {
        return json(500, { error: "Failed to load coverage areas", details: error.message });
      }
      for (const row of data ?? []) {
        const k = row.agent_id as string;
        coverageCountById.set(k, (coverageCountById.get(k) ?? 0) + 1);
      }
    }
  }

  const profileIncompleteIds = new Set<string>();
  const preferencesIncompleteIds = new Set<string>();
  for (const uid of verifiedIds) {
    const p = profileById.get(uid);
    const profileIncomplete =
      !p || !p.headshot_url?.trim() || !p.bio?.trim() || !p.company?.trim();
    if (profileIncomplete) profileIncompleteIds.add(uid);

    const prefsSet = prefSetById.get(uid) === true;
    const coverage = coverageCountById.get(uid) ?? 0;
    if (!prefsSet && coverage === 0) preferencesIncompleteIds.add(uid);
  }
  const eligibleIds = new Set<string>([
    ...profileIncompleteIds,
    ...preferencesIncompleteIds,
  ]);

  // ---- Per-recipient filtering + enqueue ----
  const skipReasons = {
    missing_email: 0,
    invalid_email: 0,
    suppressed: 0,
    already_queued: 0,
  };
  const sampleRecipients: string[] = [];
  const jobsToInsert: Array<Record<string, unknown>> = [];

  // Build iteration list. Test mode bypasses eligibility and queues to
  // explicit test emails only, still rendering the exact same email.
  const iterationSource: Array<{ agentId: string | null; email: string; firstName: string | null }> = [];
  if (testMode) {
    for (const em of testEmails) {
      iterationSource.push({ agentId: null, email: em, firstName: null });
    }
  } else {
    for (const agentId of eligibleIds) {
      const p = profileById.get(agentId);
      iterationSource.push({
        agentId,
        email: (p?.email ?? "").trim().toLowerCase(),
        firstName: p?.first_name ?? null,
      });
    }
  }

  for (const rec of iterationSource) {
    if (limit !== null && jobsToInsert.length >= limit) break;
    const agentId = rec.agentId;
    const email = rec.email;
    if (!email) {
      skipReasons.missing_email += 1;
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      skipReasons.invalid_email += 1;
      continue;
    }

    // Suppression check
    const { data: sup } = await admin.rpc("is_email_unsubscribed", {
      _email: email,
      _category: CATEGORY,
    });
    if (sup === true) {
      skipReasons.suppressed += 1;
      continue;
    }

    const idempotencyKey = testMode
      ? `hotsheet-preview-blast-test-${CAMPAIGN_DATE_TAG}-${email}`
      : `hotsheet-preview-blast-${CAMPAIGN_DATE_TAG}-${agentId}`;

    // Already-queued check
    const { data: existing } = await admin
      .from("email_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      skipReasons.already_queued += 1;
      continue;
    }

    if (sampleRecipients.length < 5) sampleRecipients.push(maskEmail(email));

    const html = buildHotSheetPreviewEmailHtml({
      recipientFirstName: rec.firstName,
      listing: previewListing,
      ctaUrl: CTA_URL,
      recipientEmail: email,
    });

    jobsToInsert.push({
      idempotency_key: idempotencyKey,
      payload: {
        provider: "resend",
        template: "hot-sheet-preview-blast",
        to: email,
        subject: HOT_SHEET_PREVIEW_BLAST_SUBJECT,
        html,
        category: CATEGORY,
        variables: {
          agentId,
          listingId: FEATURED_LISTING_ID,
          campaignDate: CAMPAIGN_DATE_TAG,
          testMode,
        },
      },
    });
  }

  let queuedCount = jobsToInsert.length;
  let skippedCount =
    skipReasons.missing_email +
    skipReasons.invalid_email +
    skipReasons.suppressed +
    skipReasons.already_queued;

  if (!dryRun && jobsToInsert.length) {
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < jobsToInsert.length; i += CHUNK) {
      const slice = jobsToInsert.slice(i, i + CHUNK);
      const { error, count } = await admin
        .from("email_jobs")
        .insert(slice, { count: "exact" });
      if (error) {
        return json(500, {
          error: "Failed to enqueue email_jobs",
          details: error.message,
          insertedBeforeFailure: inserted,
        });
      }
      inserted += count ?? slice.length;
    }
    queuedCount = inserted;
  }

  return json(200, {
    ...(testMode && testEmails.length === 1
      ? {
          success: true,
          testEmail: testEmails[0],
          message: `Test Hot Sheet preview queued for ${testEmails[0]}`,
        }
      : {}),
    dryRun,
    testMode,
    limit,
    listingId: FEATURED_LISTING_ID,
    totalVerifiedAgents,
    profileIncompleteCount: profileIncompleteIds.size,
    preferencesIncompleteCount: preferencesIncompleteIds.size,
    eligibleUnionCount: eligibleIds.size,
    queuedCount,
    skippedCount,
    skipReasons,
    sampleRecipients,
  });
});