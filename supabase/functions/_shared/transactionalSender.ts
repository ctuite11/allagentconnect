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

/** Immutable Resend From — env cannot override to notify or other subdomains. */
export const CANONICAL_TRANSACTIONAL_FROM = `${DEFAULT_TRANSACTIONAL_FROM_NAME} <${DEFAULT_TRANSACTIONAL_FROM_EMAIL}>`;

function envUsesNotifySubdomain(value: string): boolean {
  return /@notify\.allagentconnect\.com/i.test(value);
}

/** Resend-ready From header, e.g. `All Agent Connect <hello@mail.allagentconnect.com>`. */
export function buildTransactionalFrom(): string {
  const envFull = Deno.env.get("TRANSACTIONAL_FROM")?.trim();
  if (envFull) {
    if (envUsesNotifySubdomain(envFull)) {
      console.warn(
        "[transactionalSender] TRANSACTIONAL_FROM uses hello@notify — ignored; using hello@mail",
      );
    } else if (envFull.includes(DEFAULT_TRANSACTIONAL_FROM_EMAIL)) {
      return envFull;
    } else {
      console.warn(
        `[transactionalSender] TRANSACTIONAL_FROM is not hello@mail — ignored: ${envFull}`,
      );
    }
  }

  const envEmail = Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim();
  if (envEmail) {
    if (envUsesNotifySubdomain(envEmail)) {
      console.warn(
        "[transactionalSender] TRANSACTIONAL_FROM_EMAIL uses hello@notify — ignored; using hello@mail",
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
  if (envFull && !envUsesNotifySubdomain(envFull)) {
    const match = envFull.match(/<([^>]+)>/);
    if (match?.[1] && match[1].trim() === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
      return match[1].trim();
    }
    if (envFull.includes("@") && envFull === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
      return envFull;
    }
  }
  const envEmail = Deno.env.get("TRANSACTIONAL_FROM_EMAIL")?.trim();
  if (envEmail && !envUsesNotifySubdomain(envEmail) && envEmail === DEFAULT_TRANSACTIONAL_FROM_EMAIL) {
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
