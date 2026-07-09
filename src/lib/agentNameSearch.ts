import { normalizeSearchText } from "@/lib/agentNetworkSearch";

export type AgentNameSearchable = {
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Name-only matcher for the Agent Network / Find an Agent search.
 * Matches ONLY first_name and last_name — never company, email, phone,
 * service areas, bio, or any other field.
 *
 * Rules:
 * - Empty/whitespace query → match all.
 * - Every token must appear as a substring of first_name, last_name,
 *   or the concatenated "first last".
 * - Two-token queries additionally match when token1 is a prefix of
 *   first_name AND token2 is a prefix of last_name.
 */
export function matchesAgentName(agent: AgentNameSearchable, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery ?? "");
  if (!query) return true;

  const first = normalizeSearchText(agent.first_name ?? "");
  const last = normalizeSearchText(agent.last_name ?? "");
  const full = `${first} ${last}`.trim();
  const tokens = query.split(/\s+/).filter(Boolean);

  const tokenHits = (token: string) =>
    (first && first.includes(token)) ||
    (last && last.includes(token)) ||
    (full && full.includes(token));

  if (tokens.every(tokenHits)) return true;

  if (tokens.length === 2) {
    const [a, b] = tokens;
    if (first.startsWith(a) && last.startsWith(b)) return true;
  }

  return false;
}