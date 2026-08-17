export type SubmitDeveloperAccessOutcome =
  | { kind: "success" }
  | { kind: "duplicate"; message: string }
  | { kind: "validation"; messages: string[] }
  | { kind: "rate_limited" }
  | { kind: "failure" };

const DUPLICATE_MESSAGE =
  "We already have a pending request for this email. Our team will be in touch.";

const VALIDATION_LABELS: Record<string, string> = {
  "first_name is required": "First name is required.",
  "last_name is required": "Last name is required.",
  "a valid work email is required": "Please enter a valid work email.",
  "company_name is required": "Developer / Company name is required.",
  "a valid phone number is required": "Please enter a valid phone number.",
  "website must be a valid URL": "Please enter a valid website URL.",
};

/** Map backend validation detail strings to user-facing copy (no field keys). */
export function friendlyValidationMessages(details: unknown): string[] {
  if (!Array.isArray(details)) return ["Please review your submission and try again."];
  const mapped = details
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    .map((d) => VALIDATION_LABELS[d.trim()] ?? "Please review your submission and try again.");
  return mapped.length > 0 ? [...new Set(mapped)] : ["Please review your submission and try again."];
}

/** Client-side required-field checks before calling the edge function. */
export function validateDeveloperAccessForm(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
}): string[] {
  const errors: string[] = [];
  if (!input.first_name.trim()) errors.push("First name is required.");
  if (!input.last_name.trim()) errors.push("Last name is required.");
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please enter a valid work email.");
  }
  const phoneDigits = input.phone.replace(/\D/g, "");
  if (!input.phone.trim() || phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.push("Please enter a valid phone number.");
  }
  if (!input.company_name.trim()) errors.push("Developer / Company name is required.");
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

async function readInvokeBody(
  data: unknown,
  error: { context?: Response } | null,
): Promise<{ body: Record<string, unknown> | null; status: number | null }> {
  if (isRecord(data)) {
    const status =
      error?.context instanceof Response ? error.context.status : data.success === true ? 200 : null;
    return { body: data, status };
  }

  const response = error?.context instanceof Response ? error.context : null;
  if (!response) return { body: null, status: null };

  try {
    const text = await response.clone().text();
    if (!text.trim()) return { body: null, status: response.status };
    const parsed = JSON.parse(text) as unknown;
    return { body: isRecord(parsed) ? parsed : null, status: response.status };
  } catch {
    return { body: null, status: response.status };
  }
}

/**
 * Normalize edge-function success / duplicate / validation / rate-limit / failure.
 * Never surfaces request IDs or raw technical payloads to callers for UI copy.
 */
export async function parseSubmitDeveloperAccessResponse(
  data: unknown,
  error: { message?: string; context?: Response } | null,
): Promise<SubmitDeveloperAccessOutcome> {
  const { body, status } = await readInvokeBody(data, error);

  if (body?.success === true) {
    if (body.duplicate === true) {
      const message =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : DUPLICATE_MESSAGE;
      return { kind: "duplicate", message };
    }
    return { kind: "success" };
  }

  if (status === 429 || body?.error === "Too many requests") {
    return { kind: "rate_limited" };
  }

  if (status === 400 || body?.error === "Validation failed") {
    return { kind: "validation", messages: friendlyValidationMessages(body?.details) };
  }

  return { kind: "failure" };
}

export function friendlyAdminRpcError(raw: string | null | undefined): string {
  const message = (raw ?? "").toLowerCase();
  if (message.includes("admin role")) return "You don't have permission to do that.";
  if (message.includes("not found")) return "Request not found.";
  if (message.includes("already approved")) return "This request was already approved.";
  if (message.includes("owner user id")) return "An owner user ID is required.";
  if (message.includes("duplicate") || message.includes("unique")) {
    return "Could not create the development account (name or slug may already be in use).";
  }
  return "Something went wrong. Please try again.";
}
