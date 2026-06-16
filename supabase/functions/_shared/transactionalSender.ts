/**
 * Canonical transactional sender for all AAC email.
 *
 * Controlled deliverability test (Jun 2026): switch visible From to the
 * root-domain mailbox `hello@allagentconnect.com` (mirrors the old DCMLS
 * Mailjet setup that consistently inboxed Gmail). Transport, DKIM, SPF,
 * DMARC, Resend account, templates, links, and Reply-To are unchanged.
 *
 * REQUIRES: `allagentconnect.com` (root) verified as a sending domain in
 * Resend with DKIM/SPF published at the root. Until that is in place,
 * Resend will reject sends with a 403 "domain not verified" error.
 *
 * Supabase secrets (set once, do not bounce between subdomains):
 *   TRANSACTIONAL_FROM_EMAIL=hello@allagentconnect.com
 *   TRANSACTIONAL_FROM="All Agent Connect <hello@allagentconnect.com>"
 *
 * Netlify env (same values):
 *   TRANSACTIONAL_FROM_EMAIL, TRANSACTIONAL_FROM
 *
 * Bulk/outreach: keep BULK_EMAIL_PAUSED=true until a dedicated outreach subdomain exists.
 */

export const DEFAULT_TRANSACTIONAL_FROM_EMAIL = "hello@allagentconnect.com";
export const DEFAULT_TRANSACTIONAL_FROM_NAME = "All Agent Connect";

/** Immutable Resend From — env cannot override to notify/mail or other subdomains. */
export const CANONICAL_TRANSACTIONAL_FROM = `${DEFAULT_TRANSACTIONAL_FROM_NAME} <${DEFAULT_TRANSACTIONAL_FROM_EMAIL}>`;

function envUsesDisallowedSubdomain(value: string): boolean {
  // Allow only the root domain `@allagentconnect.com`.
  // Reject any subdomain variant (mail., notify., etc.).
  return /@([a-z0-9-]+)\.allagentconnect\.com/i.test(value);
}

/** Resend-ready From header, e.g. `All Agent Connect <hello@allagentconnect.com>`. */
export function buildTransactionalFrom(): string {
  const envFull = Deno.env.get("TRANSACTIONAL_FROM")?.trim();
  if (envFull) {
    if (envUsesDisallowedSubdomain(envFull)) {
      console.warn(
        "[transactionalSender] TRANSACTIONAL_FROM uses a subdomain — ignored; using root hello@allagentconnect.com",
      );
    } else if (envFull.includes(DEFAULT_TRANSACTIONAL_FROM_EMAIL)) {
      return envFull;
    } else {
      console.warn(
        `[transactionalSender] TRANSACTIONAL_FROM is not hello@allagentconnect.com — ignored: ${envFull}`,
      );
    }
  }

  const envEmail = Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim();
  if (envEmail) {
    if (envUsesDisallowedSubdomain(envEmail)) {
      console.warn(
        "[transactionalSender] TRANSACTIONAL_FROM_EMAIL uses a subdomain — ignored; using root hello@allagentconnect.com",
      );
    } else if (envEmail === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
      const name =
        Deno.env.get("TRANSACTIONAL_FROM_NAME")?.trim() ||
        DEFAULT_TRANSACTIONAL_FROM_NAME;
      return `${name} <${envEmail}>`;
    }
  }

  return CANONICAL_TRANSACTIONAL_FROM;
}

export function transactionalFromEmail(): string {
  const envFull = Deno.env.get("TRANSACTIONAL_FROM")?.trim();
  if (envFull && !envUsesDisallowedSubdomain(envFull)) {
    const match = envFull.match(/<([^>]+)>/);
    if (match?.[1] && match[1].trim() === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
      return match[1].trim();
    }
    if (envFull.includes("@") && envFull === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
      return envFull;
    }
  }
  const envEmail = Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim();
  if (envEmail && !envUsesDisallowedSubdomain(envEmail) && envEmail === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
    return envEmail;
  }
  return DEFAULT_TRANSACTIONAL_FROM_EMAIL;
}

export function transactionalFromName(): string {
  return (
    Deno.env.get("TRANSACTIONAL_FROM_NAME")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_NAME
  );
}
