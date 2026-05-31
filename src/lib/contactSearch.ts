import { supabase } from "@/integrations/supabase/client";

/**
 * Shared token-aware contact search used by share / hot-sheet dialogs.
 * Mirrors the matching behavior on /my-clients (MyClients.tsx):
 *   - 1–2 char query  → narrow prefix / word-boundary match
 *   - 3+ char query   → split on whitespace; every token must hit at least
 *                       one of: first/last/display name, email, email local,
 *                       email domain, email domain root, client_type, phone
 *
 * DB fetch stays cheap: we send a single .or(...) using ONLY the first token
 * so Supabase returns a small candidate set, then we apply the token matcher
 * client-side and cap to `limit` results.
 */

export interface ContactRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_type?: string | null;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();
const digits = (v: unknown) => String(v ?? "").replace(/\D+/g, "");
const words = (v: unknown) =>
  norm(v)
    .split(/[\s._@\-+/]+/)
    .filter(Boolean);
const wordStartsWith = (v: unknown, q: string) =>
  words(v).some((w) => w.startsWith(q));

const displayName = (c: ContactRow) => {
  const f = String(c.first_name ?? "").trim();
  const l = String(c.last_name ?? "").trim();
  const full = `${f} ${l}`.trim();
  if (full) return full;
  const email = String(c.email ?? "").trim();
  return email ? email.split("@")[0] : "";
};

/** True when `client` matches `rawQuery` using the /my-clients rules. */
export function matchesContactQuery(client: ContactRow, rawQuery: string): boolean {
  const q = norm(rawQuery);
  if (!q) return false;

  const email = norm(client.email);
  const [local, domain = ""] = email.split("@");
  const domainRoot = domain.split(".")[0] || "";

  if (q.length < 3) {
    const namePrefixHit =
      wordStartsWith(displayName(client), q) ||
      wordStartsWith(client.first_name, q) ||
      wordStartsWith(client.last_name, q);
    const emailPrefixHit =
      local.startsWith(q) || wordStartsWith(local, q) || domainRoot.startsWith(q);
    return namePrefixHit || emailPrefixHit;
  }

  const searchableFields = [
    norm(displayName(client)),
    norm(client.first_name),
    norm(client.last_name),
    email,
    local,
    domain,
    domainRoot,
    norm(client.client_type),
  ];
  const phoneDigits = digits(client.phone);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every((tok) => {
    const tokDigits = digits(tok);
    const fieldHit = searchableFields.some((f) => f.includes(tok));
    const phoneHit = tokDigits.length >= 3 && phoneDigits.includes(tokDigits);
    return fieldHit || phoneHit;
  });
}

export interface SearchClientContactsOptions {
  agentId: string;
  query: string;
  /** Columns to select. Default `"*"`. */
  select?: string;
  /** Max results returned after client-side filtering. Default 10. */
  limit?: number;
}

/**
 * Run a token-aware search against `public.clients` for a given agent.
 * Returns an empty array for empty / <2-char queries (callers may relax this).
 */
export async function searchClientContacts<T extends ContactRow = ContactRow>(
  opts: SearchClientContactsOptions,
): Promise<T[]> {
  const { agentId, query, select = "*", limit = 10 } = opts;
  const raw = (query ?? "").trim();
  if (!raw || raw.length < 2 || !agentId) return [];

  // Use the FIRST token only for the DB candidate fetch. This keeps the URL
  // short and avoids requiring any single field to contain the full phrase
  // (e.g. "ethan goodrich" should match Ethan whose email domain is goodrich).
  const firstToken = norm(raw).split(/\s+/).filter(Boolean)[0] ?? raw;
  const safe = firstToken.replace(/[,()*]/g, " ").trim();
  if (!safe) return [];

  const candidateCap = Math.max(50, limit * 5);

  const { data, error } = await supabase
    .from("clients")
    .select(select)
    .eq("agent_id", agentId)
    .or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`,
    )
    .order("first_name")
    .limit(candidateCap);

  if (error) throw error;

  const rows = ((data ?? []) as unknown as T[]).filter((row) =>
    matchesContactQuery(row, raw),
  );

  return rows.slice(0, limit);
}