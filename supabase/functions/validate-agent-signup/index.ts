import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifyTurnstileToken, TURNSTILE_GENERIC_ERROR } from "../_shared/verifyTurnstile.ts";

/**
 * Server-side mirror of src/lib/agentSignupValidation.ts.
 *
 * Anyone calling supabase.auth.signUp directly bypasses the client form,
 * so this function is the second line of defense. The frontend invokes
 * it immediately before signUp(); if it returns 400, signup is aborted.
 */

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "trashmail.com",
  "throwawaymail.com",
  "sharklasers.com",
  "getnada.com",
  "fakemailgenerator.com",
  "dispostable.com",
  "maildrop.cc",
  "mintemail.com",
  "mohmal.com",
  "mailnesia.com",
  "spamgourmet.com",
  "tempinbox.com",
]);

const NAME_RE = /^[A-Za-z][A-Za-z\s'\-\.]{1,}$/;

function digitsOnly(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function isValidUSPhone(raw: string | null | undefined): boolean {
  const d = digitsOnly(raw || "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return false;
  if (!/^[2-9]/.test(ten.slice(0, 1))) return false;
  if (!/^[2-9]/.test(ten.slice(3, 4))) return false;
  return true;
}

function isPlaceholderLicense(raw: string | null | undefined): boolean {
  const v = (raw || "").trim();
  if (v.length < 4) return true;
  const alnum = v.replace(/[^A-Za-z0-9]/g, "");
  if (alnum.length < 4) return true;
  const lower = alnum.toLowerCase();
  if (["test", "demo", "abc123", "abcdef", "license", "fake"].includes(lower)) return true;
  if (/^(.)\1+$/.test(alnum)) return true;
  if (/^\d+$/.test(alnum)) {
    let asc = true;
    let desc = true;
    for (let i = 1; i < alnum.length; i++) {
      const a = alnum.charCodeAt(i - 1);
      const b = alnum.charCodeAt(i);
      if (b !== a + 1) asc = false;
      if (b !== a - 1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

function isValidName(raw: string | null | undefined): boolean {
  const v = (raw || "").trim();
  if (v.length < 2) return false;
  return NAME_RE.test(v);
}

function isDisposableEmail(email: string | null | undefined): boolean {
  const v = (email || "").trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 0) return false;
  const domain = v.slice(at + 1);
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function licenseLastNameMatches(a: string, b: string): boolean {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase() && !!(a || "").trim();
}

function containsAtSign(raw: string | null | undefined): boolean {
  return (raw || "").includes("@");
}

const NAME_NOT_EMAIL_MSG = "Please enter a name, not an email address.";

type Body = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  licenseState?: string;
  licenseNumber?: string;
  licenseLastName?: string | null;
  turnstile_token?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    // Server-side Cloudflare Turnstile verification — blocks direct API abuse.
    const turnstileResult = await verifyTurnstileToken(body.turnstile_token, req);
    if (!turnstileResult.ok) {
      return new Response(JSON.stringify({ ok: false, errors: [TURNSTILE_GENERIC_ERROR] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: string[] = [];
    if (containsAtSign(body.firstName)) {
      errors.push(NAME_NOT_EMAIL_MSG);
    }
    if (containsAtSign(body.lastName)) {
      errors.push(NAME_NOT_EMAIL_MSG);
    }
    if (body.licenseLastName && containsAtSign(body.licenseLastName)) {
      errors.push(NAME_NOT_EMAIL_MSG);
    }
    if (!isValidName(body.firstName)) {
      errors.push("First name must be at least 2 letters and contain only letters, spaces, hyphens, or apostrophes.");
    }
    if (!isValidName(body.lastName)) {
      errors.push("Last name must be at least 2 letters and contain only letters, spaces, hyphens, or apostrophes.");
    }
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push("A valid email address is required.");
    } else if (isDisposableEmail(body.email)) {
      errors.push("Disposable email addresses are not allowed. Please use a real email.");
    }
    if (body.phone && body.phone.trim() && !isValidUSPhone(body.phone)) {
      errors.push("Phone number is not a valid US number (area code and exchange must start with 2-9).");
    }
    if (!body.licenseState || body.licenseState.length !== 2) {
      errors.push("Please select your license state.");
    }
    if (isPlaceholderLicense(body.licenseNumber)) {
      errors.push("License number looks like a placeholder. Please enter your real license number.");
    }
    if (
      body.licenseLastName &&
      body.lastName &&
      !licenseLastNameMatches(body.licenseLastName, body.lastName)
    ) {
      errors.push("License last name must match the agent's last name.");
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ ok: false, errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ ok: false, errors: [message] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});