import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for agent CRM contacts — same table/view and pagination
 * strategy as /my-clients (MyClients.tsx). All contact pickers (hot sheet, new
 * buyer, share dialogs) must use these helpers instead of ad-hoc `clients` queries.
 */

export interface ContactRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  relationship_status?: string | null;
  relationship_user_id?: string | null;
  relationship_ended_at?: string | null;
  office_id?: string | null;
  source?: string | null;
}

/** View used by the main Contacts page — includes relationship metadata. */
export const AGENT_CONTACTS_SOURCE = "clients_with_relationship_status" as const;

const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type ContactsCache = {
  agentId: string;
  rows: ContactRow[];
  fetchedAt: number;
};

let contactsCache: ContactsCache | null = null;

/** Drop cached contacts after import, create, update, or delete. */
export function invalidateAgentContactsCache(): void {
  contactsCache = null;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();
const digits = (v: unknown) => String(v ?? "").replace(/\D+/g, "");
const words = (v: unknown) =>
  norm(v)
    .split(/[\s._@\-+/]+/)
    .filter(Boolean);
const wordStartsWith = (v: unknown, q: string) =>
  words(v).some((w) => w.startsWith(q));

/** Display label for a CRM contact (same rule as /my-clients). */
export function contactDisplayName(c: ContactRow): string {
  const f = String(c.first_name ?? "").trim();
  const l = String(c.last_name ?? "").trim();
  const full = `${f} ${l}`.trim();
  if (full) return full;
  const email = String(c.email ?? "").trim();
  return email ? email.split("@")[0] : "";
}

/** Max contacts shown in share/email pickers (full CRM list is searched client-side). */
export const AGENT_SHARE_CONTACT_RESULT_LIMIT = 25;

/** True when `client` matches `rawQuery` using the /my-clients rules. */
export function matchesContactQuery(client: ContactRow, rawQuery: string): boolean {
  const q = norm(rawQuery);
  if (!q) return false;

  const email = norm(client.email);
  const [local, domain = ""] = email.split("@");
  const domainRoot = domain.split(".")[0] || "";

  if (q.length < 3) {
    const namePrefixHit =
      wordStartsWith(contactDisplayName(client), q) ||
      wordStartsWith(client.first_name, q) ||
      wordStartsWith(client.last_name, q);
    const emailPrefixHit =
      local.startsWith(q) || wordStartsWith(local, q) || domainRoot.startsWith(q);
    return namePrefixHit || emailPrefixHit;
  }

  const searchableFields = [
    norm(contactDisplayName(client)),
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
    const nameWordHit =
      wordStartsWith(contactDisplayName(client), tok) ||
      wordStartsWith(client.first_name, tok) ||
      wordStartsWith(client.last_name, tok);
    const emailWordHit =
      local.startsWith(tok) ||
      wordStartsWith(local, tok) ||
      words(local).some((w) => w.startsWith(tok) || w.includes(tok));
    const phoneHit = tokDigits.length >= 3 && phoneDigits.includes(tokDigits);
    return fieldHit || nameWordHit || emailWordHit || phoneHit;
  });
}

/**
 * Higher = better match. Used to rank picker results consistently everywhere.
 * Returns 0 when the contact does not match {@link matchesContactQuery}.
 */
export function scoreContactSearchMatch(client: ContactRow, rawQuery: string): number {
  const q = norm(rawQuery);
  if (!q || !matchesContactQuery(client, rawQuery)) return 0;

  const email = norm(client.email);
  const [local = ""] = email.split("@");
  const last = norm(client.last_name);
  const first = norm(client.first_name);
  const full = norm(contactDisplayName(client));
  const tokens = q.split(/\s+/).filter(Boolean);

  let score = 0;

  for (const tok of tokens) {
    if (last === tok) score += 200;
    else if (last.startsWith(tok)) score += 120;
    if (first === tok) score += 100;
    else if (first.startsWith(tok)) score += 80;
    if (local === tok) score += 150;
    else if (local.startsWith(tok)) score += 110;
    else if (words(local).some((w) => w === tok)) score += 90;
    else if (words(local).some((w) => w.startsWith(tok))) score += 75;
    if (full === tok) score += 95;
    else if (full.startsWith(tok)) score += 60;
    else if (full.includes(tok)) score += 35;
    if (email.includes(tok)) score += 25;
  }

  if (tokens.length > 1 && tokens.every((tok) => full.includes(tok))) {
    score += 50;
  }

  return score;
}

export interface FilterAndRankAgentContactsOptions {
  limit?: number;
  /** Share/email pickers omit contacts without an email address. */
  requireEmail?: boolean;
}

/** Shared filter + relevance ranking for all CRM contact search UIs. */
export function filterAndRankAgentContacts<T extends ContactRow = ContactRow>(
  contacts: T[],
  rawQuery: string,
  opts: FilterAndRankAgentContactsOptions = {},
): T[] {
  const { limit, requireEmail = false } = opts;
  const q = (rawQuery ?? "").trim();
  if (!q || q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) return [];

  const pool = requireEmail
    ? contacts.filter((row) => String(row.email ?? "").trim())
    : contacts;

  const ranked = pool
    .filter((row) => matchesContactQuery(row, q))
    .map((row) => ({ row, score: scoreContactSearchMatch(row, q) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return contactDisplayName(a.row).localeCompare(contactDisplayName(b.row), undefined, {
        sensitivity: "base",
      });
    })
    .map(({ row }) => row);

  return limit != null ? ranked.slice(0, limit) : ranked;
}

export interface FetchAllAgentContactsOptions {
  /** Bypass in-memory cache and re-fetch from Supabase. */
  force?: boolean;
  /** PostgREST select clause. Default `"*"`. */
  select?: string;
}

/**
 * Load every CRM contact for an agent — paginated identically to MyClients.
 */
export async function fetchAllAgentContacts<T extends ContactRow = ContactRow>(
  agentId: string,
  opts: FetchAllAgentContactsOptions = {},
): Promise<T[]> {
  if (!agentId) return [];

  const { force = false, select = "*" } = opts;

  if (
    !force &&
    contactsCache?.agentId === agentId &&
    Date.now() - contactsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return contactsCache.rows as T[];
  }

  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(AGENT_CONTACTS_SOURCE)
      .select(select)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as unknown as T[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const seen = new Set<string>();
  const unique = all.filter((row) => {
    const id = String(row.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  contactsCache = {
    agentId,
    rows: unique as ContactRow[],
    fetchedAt: Date.now(),
  };

  return unique;
}

export interface SearchClientContactsOptions {
  agentId: string;
  query: string;
  /** Ignored — kept for call-site compatibility. All contact fields are loaded. */
  select?: string;
  /** Max results returned after client-side filtering. Default 10. */
  limit?: number;
  /** Force-refresh the backing contact list before searching. */
  forceRefresh?: boolean;
}

/**
 * Token-aware search against the same contact list as /my-clients.
 * Returns an empty array for empty / <2-char queries.
 */
export async function searchClientContacts<T extends ContactRow = ContactRow>(
  opts: SearchClientContactsOptions,
): Promise<T[]> {
  const { agentId, query, limit = 10, forceRefresh = false } = opts;
  const raw = (query ?? "").trim();
  if (!raw || raw.length < 2 || !agentId) return [];

  const all = await fetchAllAgentContacts<T>(agentId, { force: forceRefresh });
  return filterAndRankAgentContacts(all, raw, { limit });
}

export interface FilterAgentContactsForSharePickerOptions {
  agentId: string;
  query?: string;
  limit?: number;
  forceRefresh?: boolean;
}

/** Minimum query length before CRM contact search runs (share pickers, hot sheet, etc.). */
export const AGENT_CONTACT_MIN_QUERY_LENGTH = 2;

/** @deprecated Use {@link AGENT_CONTACT_MIN_QUERY_LENGTH}. */
export const AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH = AGENT_CONTACT_MIN_QUERY_LENGTH;

/**
 * Share-dialog contact picker — same paginated CRM list as /my-clients, filtered client-side.
 * Returns nothing until the user types at least {@link AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH} characters.
 */
export async function filterAgentContactsForSharePicker<T extends ContactRow = ContactRow>(
  opts: FilterAgentContactsForSharePickerOptions,
): Promise<T[]> {
  const {
    agentId,
    query = "",
    limit = AGENT_SHARE_CONTACT_RESULT_LIMIT,
    forceRefresh = false,
  } = opts;
  if (!agentId) return [];

  const q = query.trim();
  if (!q || q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) return [];

  const all = await fetchAllAgentContacts<T>(agentId, { force: forceRefresh });
  return filterAndRankAgentContacts(all, q, { limit, requireEmail: true });
}

export interface MessageableClientRecipient {
  id: string;
  name: string;
  email: string;
  subtitle: string;
}

function formatClientTypeLabel(clientType: string | null | undefined): string {
  const raw = String(clientType ?? "").trim().toLowerCase();
  if (!raw || raw === "buyer") return "Buyer";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * CRM contacts the agent can DM — same list as /my-clients, filtered to onboarded buyers.
 */
export async function fetchMessageableClientRecipients(
  agentId: string,
): Promise<MessageableClientRecipient[]> {
  if (!agentId) return [];

  const contacts = await fetchAllAgentContacts(agentId, {
    select:
      "id, first_name, last_name, email, client_type, relationship_user_id, relationship_status, relationship_ended_at",
  });

  const seen = new Set<string>();
  const results: MessageableClientRecipient[] = [];

  for (const c of contacts) {
    if (c.relationship_status === "ended" || c.relationship_ended_at) continue;

    const authUserId = String(c.relationship_user_id ?? "").trim();
    if (!authUserId || seen.has(authUserId)) continue;
    seen.add(authUserId);

    results.push({
      id: authUserId,
      name: contactDisplayName(c) || authUserId,
      email: String(c.email ?? "").trim(),
      subtitle: formatClientTypeLabel(c.client_type),
    });
  }

  return results;
}
