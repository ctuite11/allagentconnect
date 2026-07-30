/**
 * Agent Network directory search — card-visible fields only.
 * Must stay aligned with `AgentPhotoTile` (name, brokerage line, email, phone).
 */

export type AgentNetworkSearchable = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
};

/**
 * Lowercase, fold diacritics, strip apostrophes, turn other punctuation into
 * spaces, collapse whitespace.
 *
 * Important: do NOT use `[^\w\s]` — JS `\w` is ASCII-only, so "José" / "García"
 * would become "jos" / "garc a" and fail to match "jose" / "garcia".
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters/digits only — for O'Brien → obrien, Anne-Marie → annemarie. */
export function collapseSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Same brokerage string shown on the agent card. */
function displayedBrokerage(agent: AgentNetworkSearchable): string {
  return (agent.company || agent.office_name || agent.team_name || "").trim();
}

/** Same phone line shown on the agent card (cell preferred). */
function displayedPhone(agent: AgentNetworkSearchable): string {
  return (agent.cell_phone || agent.phone || "").trim();
}

/** Normalized strings for fields the user can see on each card. */
export function getAgentNetworkSearchFields(agent: AgentNetworkSearchable): string[] {
  const first = (agent.first_name ?? "").trim();
  const last = (agent.last_name ?? "").trim();
  const fullName = `${first} ${last}`.trim();

  return [
    first,
    last,
    fullName,
    displayedBrokerage(agent),
    agent.email ?? "",
    displayedPhone(agent),
  ]
    .map(normalizeSearchText)
    .filter(Boolean);
}

/**
 * Substring match on visible card fields only.
 * Multi-word queries require every word to match at least one visible field.
 */
export function matchesAgentNetworkSearch(agent: AgentNetworkSearchable, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery);
  if (!query) return true;

  const fields = getAgentNetworkSearchFields(agent);
  const tokens = query.split(/\s+/).filter(Boolean);
  const phoneDigits = normalizePhoneDigits(displayedPhone(agent));

  return tokens.every((token) => {
    if (/^\d+$/.test(token)) {
      return phoneDigits.includes(token);
    }
    return fields.some((field) => field.includes(token));
  });
}
