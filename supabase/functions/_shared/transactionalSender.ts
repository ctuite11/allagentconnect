/**
 * Canonical transactional sender for all AAC email.
 *
 * Jun 2026: root domain `allagentconnect.com` is verified in Resend.
 * Visible From is on the root domain for deliverability (subdomains
 * `notify.` / `mail.` showed degraded inbox placement). To revert,
 * set `DEFAULT_TRANSACTIONAL_FROM_EMAIL` back to a verified subdomain.
 *
 * No other knobs changed: transport, DKIM/SPF/DMARC on the subdomain,
 * Resend account, templates, links, and Reply-To are unchanged.
 *
 * Bulk/outreach: keep BULK_EMAIL_PAUSED=true until a dedicated outreach subdomain exists.
 */

export const DEFAULT_TRANSACTIONAL_FROM_EMAIL = "chris@allagentconnect.com";
export const DEFAULT_TRANSACTIONAL_FROM_NAME = "All Agent Connect";

/** Resend From, hard-locked to the currently-verified sender. */
export const CANONICAL_TRANSACTIONAL_FROM = `${DEFAULT_TRANSACTIONAL_FROM_NAME} <${DEFAULT_TRANSACTIONAL_FROM_EMAIL}>`;

/** Resend-ready From header — hard-locked, env cannot override during revert. */
export function buildTransactionalFrom(): string {
  return CANONICAL_TRANSACTIONAL_FROM;
}

export function transactionalFromEmail(): string {
  return DEFAULT_TRANSACTIONAL_FROM_EMAIL;
}

export function transactionalFromName(): string {
  return (
    Deno.env.get("TRANSACTIONAL_FROM_NAME")?.trim() ||
    DEFAULT_TRANSACTIONAL_FROM_NAME
  );
}
