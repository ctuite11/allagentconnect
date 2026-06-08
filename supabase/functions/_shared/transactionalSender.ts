/**
 * Canonical transactional sender for all AAC email.
 *
 * Proven inboxing path (Jun 2026): All Agent Connect <hello@mail.allagentconnect.com>
 * with agent identity in Reply-To / subject / body — never in rotating From names.
 *
 * Supabase secrets (set once, do not bounce between mail/notify):
 *   TRANSACTIONAL_FROM_EMAIL=hello@mail.allagentconnect.com
 *   TRANSACTIONAL_FROM="All Agent Connect <hello@mail.allagentconnect.com>"
 *
 * Netlify env (same values):
 *   TRANSACTIONAL_FROM_EMAIL, TRANSACTIONAL_FROM
 *
 * Bulk/outreach: keep BULK_EMAIL_PAUSED=true until a dedicated outreach subdomain exists.
 */

export const DEFAULT_TRANSACTIONAL_FROM_EMAIL = "hello@mail.allagentconnect.com";
export const DEFAULT_TRANSACTIONAL_FROM_NAME = "All Agent Connect";

/** Resend-ready From header, e.g. `All Agent Connect <hello@mail.allagentconnect.com>`. */
export function buildTransactionalFrom(): string {
  const envFull = Deno.env.get("TRANSACTIONAL_FROM")?.trim();
  if (envFull) return envFull;

  const email =
    Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim() ||
    Deno.env.get("RESEND_FROM_EMAIL")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_EMAIL;

  const name =
    Deno.env.get("TRANSACTIONAL_FROM_NAME")?.trim() ||
    Deno.env.get("RESEND_FROM_NAME")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_NAME;

  return `${name} <${email}>`;
}

export function transactionalFromEmail(): string {
  const envFull = Deno.env.get("TRANSACTIONAL_FROM")?.trim();
  if (envFull) {
    const match = envFull.match(/<([^>]+)>/);
    if (match?.[1]) return match[1].trim();
    if (envFull.includes("@")) return envFull;
  }
  return (
    Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim() ||
    Deno.env.get("RESEND_FROM_EMAIL")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_EMAIL
  );
}

export function transactionalFromName(): string {
  return (
    Deno.env.get("TRANSACTIONAL_FROM_NAME")?.trim() ||
    Deno.env.get("RESEND_FROM_NAME")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_NAME
  );
}
