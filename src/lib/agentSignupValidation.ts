/**
 * Agent signup validators — used by both client (Auth.tsx) and server
 * (validate-agent-signup edge function) and by admin red-flag surfacing
 * (AdminApprovals RiskBadges).
 *
 * Keep this file dependency-free so it can be copied verbatim into the
 * edge function.
 */

export type RiskCode =
  | "invalid_phone"
  | "placeholder_license"
  | "license_last_name_mismatch"
  | "disposable_email"
  | "invalid_name"
  | "no_company";

export type RiskSeverity = "red" | "amber";

export type Risk = { code: RiskCode; label: string; severity: RiskSeverity };

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
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

/** True when the value contains an "@" — used to catch emails typed into name fields. */
export function containsAtSign(raw: string | null | undefined): boolean {
  return (raw || "").includes("@");
}

const NAME_NOT_EMAIL_MSG = "Please enter a name, not an email address.";

/** Strip everything except digits. */
function digitsOnly(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

/** US NANP phone: 10 digits; area-code first digit 2-9; exchange first digit 2-9. */
export function isValidUSPhone(raw: string | null | undefined): boolean {
  const d = digitsOnly(raw || "");
  // Allow leading "1" country code
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10) return false;
  if (!/^[2-9]/.test(ten.slice(0, 1))) return false;
  if (!/^[2-9]/.test(ten.slice(3, 4))) return false;
  return true;
}

/**
 * Reject obviously-fake license numbers:
 *  - shorter than 4 alphanumerics
 *  - all-same-digit (e.g. 111111, 0000)
 *  - strictly sequential ascending or descending digits (e.g. 123456, 654321)
 *  - common placeholder strings (test, demo, abc123)
 */
export function isPlaceholderLicense(raw: string | null | undefined): boolean {
  const v = (raw || "").trim();
  if (v.length < 4) return true;
  const alnum = v.replace(/[^A-Za-z0-9]/g, "");
  if (alnum.length < 4) return true;
  const lower = alnum.toLowerCase();
  if (["test", "demo", "abc123", "abcdef", "license", "fake"].includes(lower)) return true;
  // All-same-character
  if (/^(.)\1+$/.test(alnum)) return true;
  // Pure digit sequences — check ascending/descending strict run
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

/** First/last name — letters + spaces/hyphens/apostrophes/periods, min 2. */
export function isValidName(raw: string | null | undefined): boolean {
  const v = (raw || "").trim();
  if (v.length < 2) return false;
  return NAME_RE.test(v);
}

/** Disposable / throwaway email check (domain match against built-in list). */
export function isDisposableEmail(email: string | null | undefined): boolean {
  const v = (email || "").trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 0) return false;
  const domain = v.slice(at + 1);
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/** Exact case-insensitive match between license_last_name and form last_name. */
export function licenseLastNameMatches(
  licenseLastName: string | null | undefined,
  formLastName: string | null | undefined,
): boolean {
  const a = (licenseLastName || "").trim().toLowerCase();
  const b = (formLastName || "").trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

export type AgentSignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  licenseState: string;
  licenseNumber: string;
  licenseLastName?: string | null;
  company?: string | null;
};

/**
 * Hard-fail validation. Returns a list of human-readable errors; empty
 * array means valid. Used at signup. The "no_company" amber signal is
 * only surfaced via `assessRisks`, not here.
 */
export function validateAgentSignup(input: AgentSignupInput): string[] {
  const errors: string[] = [];
  if (containsAtSign(input.firstName)) {
    errors.push(NAME_NOT_EMAIL_MSG);
  }
  if (containsAtSign(input.lastName)) {
    errors.push(NAME_NOT_EMAIL_MSG);
  }
  if (input.licenseLastName && containsAtSign(input.licenseLastName)) {
    errors.push(NAME_NOT_EMAIL_MSG);
  }
  if (!isValidName(input.firstName)) {
    errors.push("First name must be at least 2 letters and contain only letters, spaces, hyphens, or apostrophes.");
  }
  if (!isValidName(input.lastName)) {
    errors.push("Last name must be at least 2 letters and contain only letters, spaces, hyphens, or apostrophes.");
  }
  if (isDisposableEmail(input.email)) {
    errors.push("Disposable email addresses are not allowed. Please use a real email.");
  }
  if (input.phone && input.phone.trim() && !isValidUSPhone(input.phone)) {
    errors.push("Phone number is not a valid US number (area code and exchange must start with 2-9).");
  }
  if (!input.licenseState || input.licenseState.length !== 2) {
    errors.push("Please select your license state.");
  }
  if (isPlaceholderLicense(input.licenseNumber)) {
    errors.push("License number looks like a placeholder. Please enter your real license number.");
  }
  // The license last name comes from the form's last_name field at signup,
  // so we only check the explicit licenseLastName field if it is provided
  // (admin edits, server checks). At signup we trust the form symmetry.
  if (
    input.licenseLastName !== undefined &&
    input.licenseLastName !== null &&
    !licenseLastNameMatches(input.licenseLastName, input.lastName)
  ) {
    errors.push("License last name must match the agent's last name.");
  }
  return errors;
}

/**
 * Soft assessment for admin UI. Returns red flags (hard issues) and
 * amber flags (soft signals) to surface on the AdminApprovals card.
 */
export function assessRisks(input: AgentSignupInput): Risk[] {
  const risks: Risk[] = [];
  if (input.phone && input.phone.trim() && !isValidUSPhone(input.phone)) {
    risks.push({ code: "invalid_phone", label: "Invalid phone", severity: "red" });
  }
  if (isPlaceholderLicense(input.licenseNumber)) {
    risks.push({ code: "placeholder_license", label: "Placeholder license", severity: "red" });
  }
  if (
    input.licenseLastName &&
    !licenseLastNameMatches(input.licenseLastName, input.lastName)
  ) {
    risks.push({
      code: "license_last_name_mismatch",
      label: "Last name mismatch",
      severity: "red",
    });
  }
  if (isDisposableEmail(input.email)) {
    risks.push({ code: "disposable_email", label: "Disposable email", severity: "red" });
  }
  if (!isValidName(input.firstName) || !isValidName(input.lastName)) {
    risks.push({ code: "invalid_name", label: "Invalid name", severity: "red" });
  }
  if (!input.company || !input.company.trim()) {
    risks.push({ code: "no_company", label: "No company", severity: "amber" });
  }
  return risks;
}

export function hasRedFlag(risks: Risk[]): boolean {
  return risks.some((r) => r.severity === "red");
}