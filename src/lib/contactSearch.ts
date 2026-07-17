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

// ── Unified message recipient search (New Message compose) ─────────────────

export type UnifiedMessageRecipientRole = "buyer" | "agent" | "verified_agent";

export interface UnifiedMessageRecipient {
  /** Stable dedupe key — normalized email when present, else auth user id. */
  mergeKey: string;
  displayName: string;
  email: string;
  phone: string | null;
  roles: UnifiedMessageRecipientRole[];
  /** Auth user id passed to findOrCreateConversation. */
  messageUserId: string;
  headshotUrl: string | null;
  crmContactId: string | null;
  /** Set when this person matched via My Contacts (for search ranking). */
  crmContact: ContactRow | null;
}

interface AgentPeerForMerge {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  headshot_url: string | null;
  isVerified: boolean;
}

function normEmailForMerge(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

function agentPeerRole(peer: AgentPeerForMerge): UnifiedMessageRecipientRole {
  return peer.isVerified ? "verified_agent" : "agent";
}

function mergeRoleList(
  existing: UnifiedMessageRecipientRole[],
  incoming: UnifiedMessageRecipientRole[],
): UnifiedMessageRecipientRole[] {
  const merged = new Set([...existing, ...incoming]);
  if (merged.has("verified_agent")) merged.delete("agent");
  const order: UnifiedMessageRecipientRole[] = ["buyer", "agent", "verified_agent"];
  return order.filter((r) => merged.has(r));
}

/** Human-readable role badges for unified contact rows. */
export function formatUnifiedMessageRecipientRoles(roles: UnifiedMessageRecipientRole[]): string {
  const labels: string[] = [];
  if (roles.includes("buyer")) labels.push("Buyer");
  if (roles.includes("verified_agent")) labels.push("Verified Agent");
  else if (roles.includes("agent")) labels.push("Agent");
  return labels.join(" · ");
}

/**
 * Merge My Contacts (CRM) with network agents into one row per person (by email, then user id).
 * CRM rows take precedence for display name and buyer role.
 */
export function mergeUnifiedMessageRecipients(
  agentId: string,
  crmContacts: ContactRow[],
  agentPeers: AgentPeerForMerge[],
): UnifiedMessageRecipient[] {
  const byMergeKey = new Map<string, UnifiedMessageRecipient>();
  const userIdToMergeKey = new Map<string, string>();
  const agentPeerById = new Map(agentPeers.map((a) => [a.id, a]));

  const upsert = (entry: UnifiedMessageRecipient) => {
    const existing = byMergeKey.get(entry.mergeKey);
    if (!existing) {
      byMergeKey.set(entry.mergeKey, { ...entry, roles: [...entry.roles] });
    } else {
      existing.roles = mergeRoleList(existing.roles, entry.roles);
      if (!existing.displayName.trim() && entry.displayName.trim()) {
        existing.displayName = entry.displayName;
      }
      if (!existing.email && entry.email) existing.email = entry.email;
      if (!existing.phone && entry.phone) existing.phone = entry.phone;
      if (!existing.headshotUrl && entry.headshotUrl) existing.headshotUrl = entry.headshotUrl;
      if (!existing.crmContactId && entry.crmContactId) {
        existing.crmContactId = entry.crmContactId;
        existing.crmContact = entry.crmContact;
      }
      if (!existing.messageUserId && entry.messageUserId) {
        existing.messageUserId = entry.messageUserId;
      }
    }
    const row = byMergeKey.get(entry.mergeKey)!;
    if (row.messageUserId) userIdToMergeKey.set(row.messageUserId, row.mergeKey);
  };

  for (const c of crmContacts) {
    if (c.relationship_status === "ended" || c.relationship_ended_at) continue;

    const email = String(c.email ?? "").trim();
    const emailKey = normEmailForMerge(email);
    const authUserId = String(c.relationship_user_id ?? "").trim();
    const mergeKey = emailKey || authUserId || String(c.id);
    const peer = authUserId ? agentPeerById.get(authUserId) : undefined;

    const roles: UnifiedMessageRecipientRole[] = [];
    if (authUserId) roles.push("buyer");
    if (peer) roles.push(agentPeerRole(peer));

    const messageUserId = authUserId || peer?.id || "";
    if (!messageUserId) continue;

    upsert({
      mergeKey,
      displayName: contactDisplayName(c),
      email,
      phone: String(c.phone ?? "").trim() || null,
      roles,
      messageUserId,
      headshotUrl: peer?.headshot_url ?? null,
      crmContactId: c.id,
      crmContact: c,
    });
  }

  for (const peer of agentPeers) {
    if (peer.id === agentId) continue;

    const linkedKey = userIdToMergeKey.get(peer.id);
    if (linkedKey) {
      const existing = byMergeKey.get(linkedKey)!;
      existing.roles = mergeRoleList(existing.roles, [agentPeerRole(peer)]);
      existing.headshotUrl = existing.headshotUrl ?? peer.headshot_url ?? null;
      if (!existing.messageUserId) existing.messageUserId = peer.id;
      continue;
    }

    const email = String(peer.email ?? "").trim();
    const emailKey = normEmailForMerge(email);
    if (emailKey && byMergeKey.has(emailKey)) {
      const existing = byMergeKey.get(emailKey)!;
      existing.roles = mergeRoleList(existing.roles, [agentPeerRole(peer)]);
      existing.headshotUrl = existing.headshotUrl ?? peer.headshot_url ?? null;
      if (!existing.messageUserId) existing.messageUserId = peer.id;
      userIdToMergeKey.set(peer.id, emailKey);
      continue;
    }

    const mergeKey = emailKey || peer.id;
    const name = `${peer.first_name ?? ""} ${peer.last_name ?? ""}`.trim();
    upsert({
      mergeKey,
      displayName: name || email || peer.id,
      email,
      phone: null,
      roles: [agentPeerRole(peer)],
      messageUserId: peer.id,
      headshotUrl: peer.headshot_url ?? null,
      crmContactId: null,
      crmContact: null,
    });
    userIdToMergeKey.set(peer.id, mergeKey);
  }

  return [...byMergeKey.values()]
    .filter((e) => Boolean(e.messageUserId))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );
}

function scoreUnifiedMessageRecipient(
  entry: UnifiedMessageRecipient,
  rawQuery: string,
): number {
  if (entry.crmContact) return scoreContactSearchMatch(entry.crmContact, rawQuery);

  const parts = entry.displayName.trim().split(/\s+/);
  const synthetic: ContactRow = {
    id: entry.mergeKey,
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
    email: entry.email,
    phone: entry.phone,
  };
  return scoreContactSearchMatch(synthetic, rawQuery);
}

export function filterUnifiedMessageRecipients(
  directory: UnifiedMessageRecipient[],
  rawQuery: string,
  limit = 25,
): UnifiedMessageRecipient[] {
  const q = (rawQuery ?? "").trim();
  if (!q || q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) return [];

  return directory
    .map((entry) => ({ entry, score: scoreUnifiedMessageRecipient(entry, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aCrm = a.entry.crmContactId ? 1 : 0;
      const bCrm = b.entry.crmContactId ? 1 : 0;
      if (bCrm !== aCrm) return bCrm - aCrm;
      return a.entry.displayName.localeCompare(b.entry.displayName, undefined, {
        sensitivity: "base",
      });
    })
    .map(({ entry }) => entry)
    .slice(0, limit);
}

/** Max candidate rows fetched per source per search — plenty for a 25-result picker. */
const RECIPIENT_CANDIDATE_LIMIT = 50;

/** Strip characters that break PostgREST `.or()` filter syntax or act as ilike wildcards. */
function sanitizeIlikeToken(tok: string): string {
  return tok.replace(/[,()%_\\]/g, "").trim();
}

/** Query tokens safe to embed in ilike patterns (max 3 — enough for "first last" + one). */
function tokenizeRecipientQuery(rawQuery: string): string[] {
  return (rawQuery ?? "")
    .trim()
    .split(/\s+/)
    .map(sanitizeIlikeToken)
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Server-side CRM candidate search — every token must hit name/email/phone.
 * Chained `.or()` groups AND together in PostgREST.
 */
async function searchCrmContactCandidates(
  agentId: string,
  tokens: string[],
): Promise<ContactRow[]> {
  let qb = supabase
    .from(AGENT_CONTACTS_SOURCE)
    .select(
      "id, first_name, last_name, email, phone, client_type, relationship_user_id, relationship_status, relationship_ended_at",
    )
    .eq("agent_id", agentId);

  for (const tok of tokens) {
    const pat = `%${tok}%`;
    qb = qb.or(
      `first_name.ilike.${pat},last_name.ilike.${pat},email.ilike.${pat},phone.ilike.${pat}`,
    );
  }

  const { data, error } = await qb.limit(RECIPIENT_CANDIDATE_LIMIT);
  if (error) throw error;
  return (data ?? []) as ContactRow[];
}

/** Server-side agent network candidate search, with verified lookup on candidates only. */
async function searchAgentPeerCandidates(
  agentId: string,
  tokens: string[],
): Promise<AgentPeerForMerge[]> {
  let qb = supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email, headshot_url")
    .neq("id", agentId);

  for (const tok of tokens) {
    const pat = `%${tok}%`;
    qb = qb.or(`first_name.ilike.${pat},last_name.ilike.${pat},email.ilike.${pat}`);
  }

  const { data, error } = await qb.order("last_name").limit(RECIPIENT_CANDIDATE_LIMIT);
  if (error) throw error;

  const peers = data ?? [];
  if (peers.length === 0) return [];

  // Verified lookup is best-effort — a failure downgrades the role badge to
  // "Agent" rather than failing the search.
  const verifiedIds = new Set<string>();
  const { data: settingsRows, error: settingsError } = await supabase
    .from("agent_settings")
    .select("user_id, agent_status")
    .in(
      "user_id",
      peers.map((p) => p.id),
    );
  if (settingsError) {
    console.error("[contactSearch] agent_settings lookup failed:", settingsError);
  } else {
    for (const s of settingsRows ?? []) {
      if (s.agent_status === "verified") verifiedIds.add(s.user_id);
    }
  }

  return peers.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    headshot_url: p.headshot_url,
    isVerified: verifiedIds.has(p.id),
  }));
}

/**
 * Search unified message recipients for the signed-in agent's New Message compose.
 * Candidates are filtered server-side by the typed tokens (no full-directory
 * download), then merged and ranked with the shared client-side rules.
 */
export async function searchUnifiedMessageRecipients(
  agentId: string,
  query: string,
  opts: { forceRefresh?: boolean; limit?: number } = {},
): Promise<UnifiedMessageRecipient[]> {
  const q = (query ?? "").trim();
  if (!agentId || !q || q.length < AGENT_CONTACT_MIN_QUERY_LENGTH) return [];

  const tokens = tokenizeRecipientQuery(q);
  if (tokens.length === 0) return [];

  // One failing source must not blank the whole result set (e.g. a CRM view
  // error should not hide every agent).
  const [crmResult, peersResult] = await Promise.allSettled([
    searchCrmContactCandidates(agentId, tokens),
    searchAgentPeerCandidates(agentId, tokens),
  ]);

  if (crmResult.status === "rejected" && peersResult.status === "rejected") {
    console.error(
      "[contactSearch] both recipient search sources failed:",
      crmResult.reason,
      peersResult.reason,
    );
    throw crmResult.reason;
  }
  if (crmResult.status === "rejected") {
    console.error("[contactSearch] CRM candidate search failed (agents still searchable):", crmResult.reason);
  }
  if (peersResult.status === "rejected") {
    console.error("[contactSearch] agent candidate search failed (CRM still searchable):", peersResult.reason);
  }

  const crmContacts = crmResult.status === "fulfilled" ? crmResult.value : [];
  const agentPeers = peersResult.status === "fulfilled" ? peersResult.value : [];

  const entries = mergeUnifiedMessageRecipients(agentId, crmContacts, agentPeers);
  return filterUnifiedMessageRecipients(entries, q, opts.limit ?? 25);
}
