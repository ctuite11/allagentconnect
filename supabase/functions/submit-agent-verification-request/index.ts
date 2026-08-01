import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateAgentSignup,
  type AgentSignupInput,
} from "../_shared/agentSignupValidation.ts";
import {
  verifyTurnstileToken,
  TURNSTILE_GENERIC_ERROR,
} from "../_shared/verifyTurnstile.ts";

/**
 * Phase 1 backend foundation. Public endpoint for the future Request Access
 * form. Does NOT send emails or notify admins yet — that ships with the UI
 * in Phase 2.
 *
 * Behavior:
 *   1. Method/CORS guards.
 *   2. Validate input (Zod-lite manual checks + validateAgentSignup).
 *   3. Verify Turnstile token.
 *   4. If a confirmed auth user already exists → { code: "account_exists" }.
 *   5. If an open pending row exists → { code: "already_pending" } (idempotent).
 *   6. Insert new row (status='pending', user_id=null).
 *   7. On unique-violation race → return already_pending.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_NOTIFY_EMAIL = "chris@allagentconnect.com";
const ADMIN_PANEL_URL = "https://allagentconnect.com/admin/approvals";

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("operation_timed_out")), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

const STATE_LICENSE_LOOKUP: Record<string, string> = {
  MA: "https://www.mass.gov/orgs/board-of-registration-of-real-estate-brokers-and-salespersons",
  CT: "https://www.elicense.ct.gov/",
  RI: "https://dbr.ri.gov/divisions/commercial-licensing",
  NH: "https://www.oplc.nh.gov/real-estate-commission",
  ME: "https://www.maine.gov/pfr/professionallicensing/",
  VT: "https://sos.vermont.gov/opr/",
  NY: "https://appext20.dos.ny.gov/nydos/selSearchType.do",
  NJ: "https://newjersey.mylicense.com/verification/",
  PA: "https://www.pals.pa.gov/",
};

async function enqueueAdminNotification(
  admin: ReturnType<typeof createClient>,
  pendingId: string,
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    licenseState: string;
    licenseNumber: string;
  },
) {
  const idempotencyKey = `verification-submitted:${pendingId}`;
  const subject = `New License Verification — ${applicant.firstName} ${applicant.lastName}`;
  const payload = {
    provider: "resend",
    template: "agent-verification-submitted",
    to: ADMIN_NOTIFY_EMAIL,
    subject,
    reply_to: applicant.email,
    variables: {
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      email: applicant.email,
      phone: applicant.phone ?? "",
      company: applicant.company ?? "",
      licenseState: applicant.licenseState,
      licenseNumber: applicant.licenseNumber,
      submittedAt: new Date().toISOString(),
      adminUrl: ADMIN_PANEL_URL,
      licenseLookupUrl: STATE_LICENSE_LOOKUP[applicant.licenseState] || "",
    },
  };

  const { error: insertErr } = await admin
    .from("email_jobs")
    .insert({ payload, idempotency_key: idempotencyKey });

  if (insertErr) {
    // 23505 = idempotency race → already notified for this pending id.
    // deno-lint-ignore no-explicit-any
    const code = (insertErr as any).code;
    if (code === "23505") {
      console.log(
        `[submit-agent-verification-request] admin notification already queued for ${pendingId}`,
      );
      return;
    }
    console.error(
      "[submit-agent-verification-request] failed to enqueue admin notification (non-fatal):",
      insertErr,
    );
    return;
  }

  // Best-effort kick — do not block the caller.
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kick-email-queue`, {
      method: "POST",
      signal: AbortSignal.timeout(1500),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
      },
      body: "{}",
    });
  } catch (e) {
    console.warn("[submit-agent-verification-request] kick-email-queue failed (non-fatal):", e);
  }
}

interface SubmitBody {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  licenseState?: unknown;
  licenseNumber?: unknown;
  licenseLastName?: unknown;
  turnstileToken?: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asTrimmedString(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asOptionalString(v: unknown, max = 200): string | null {
  const s = asTrimmedString(v, max);
  return s.length ? s : null;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const firstName = asTrimmedString(body.firstName, 100);
  const lastName = asTrimmedString(body.lastName, 100);
  const email = asTrimmedString(body.email, 320).toLowerCase();
  const phone = asOptionalString(body.phone, 40);
  const company = asOptionalString(body.company, 200);
  const licenseState = asTrimmedString(body.licenseState, 2).toUpperCase();
  const licenseNumber = asTrimmedString(body.licenseNumber, 60);
  const licenseLastName = asOptionalString(body.licenseLastName, 100);
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (!email || !email.includes("@")) {
    return json(400, { error: "A valid email is required.", code: "invalid_email" });
  }

  const signupInput: AgentSignupInput = {
    firstName,
    lastName,
    email,
    phone,
    licenseState,
    licenseNumber,
    licenseLastName,
    company,
  };
  const validationErrors = validateAgentSignup(signupInput);
  if (validationErrors.length > 0) {
    return json(400, {
      error: validationErrors[0],
      code: "validation_failed",
      errors: validationErrors,
    });
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, req);
  if (!turnstile.ok) {
    return json(403, { error: TURNSTILE_GENERIC_ERROR, code: "turnstile_failed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 4: use an indexed server-side lookup. Scanning the complete auth user
  // list made registration exceed the client's 20-second timeout.
  try {
    const { data: accountExists, error: lookupErr } = await withTimeout(
      admin.rpc("auth_user_exists_by_email", { p_email: email }),
      4000,
    );
    if (lookupErr) {
      console.error("[submit-agent-verification-request] account lookup error:", lookupErr.message);
      return json(503, { error: "Could not check account status. Please try again.", code: "lookup_failed" });
    }
    if (accountExists === true) {
      return json(200, {
        ok: false,
        code: "account_exists",
        message: "An account with this email already exists. Please sign in.",
      });
    }
  } catch (err) {
    console.error("[submit-agent-verification-request] account lookup threw:", err);
    return json(503, { error: "Could not check account status. Please try again.", code: "lookup_failed" });
  }

  // Step 5+6: insert. Rely on the partial unique index on lower(email)
  // WHERE status='pending' to detect duplicates race-safely.
  const { data: inserted, error: insertErr } = await admin
    .from("pending_verifications")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      company,
      license_state: licenseState,
      license_number: licenseNumber,
      license_last_name: licenseLastName,
      status: "pending",
      user_id: null,
      turnstile_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    // 23505 = unique_violation → race on the partial index.
    // deno-lint-ignore no-explicit-any
    const code = (insertErr as any).code;
    if (code === "23505") {
      // Notify admin even on re-submit — idempotency key on email_jobs
      // ensures we send at most one notification per pending row.
      try {
        const { data: existing } = await admin
          .from("pending_verifications")
          .select("id")
          .ilike("email", email)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          await withTimeout(
            enqueueAdminNotification(admin, existing.id, {
              firstName,
              lastName,
              email,
              phone,
              company,
              licenseState,
              licenseNumber,
            }),
            3000,
          );
        }
      } catch (e) {
        console.error(
          "[submit-agent-verification-request] already_pending admin notify failed (non-fatal):",
          e,
        );
      }
      return json(200, {
        ok: true,
        code: "already_pending",
        message: "We already have your request on file. We'll be in touch shortly.",
      });
    }
    console.error("[submit-agent-verification-request] insert error:", insertErr);
    return json(500, { error: "Failed to record request.", code: "insert_failed" });
  }

  // Fresh insert → notify admin. Never fails the request.
  try {
    await withTimeout(
      enqueueAdminNotification(admin, inserted.id, {
        firstName,
        lastName,
        email,
        phone,
        company,
        licenseState,
        licenseNumber,
      }),
      3000,
    );
  } catch (e) {
    console.error(
      "[submit-agent-verification-request] admin notify threw (non-fatal):",
      e,
    );
  }

  return json(200, {
    ok: true,
    code: "submitted",
    id: inserted.id,
  });
}

Deno.serve(handleRequest);