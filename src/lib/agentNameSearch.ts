import { collapseSearchText, normalizeSearchText } from "@/lib/agentNetworkSearch";

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
 * - Every token must match as a word prefix of first_name or last_name
 *   (order-independent), so "smith john" and "john smith" both work.
 * - Collapsed forms also match (O'Brien ↔ obrien, Anne-Marie ↔ annemarie).
 * - Avoids mid-word false positives ("lee" must not match "Kathleen").
 */
export function matchesAgentName(agent: AgentNameSearchable, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery ?? "");
  if (!query) return true;

  const first = normalizeSearchText(agent.first_name ?? "");
  const last = normalizeSearchText(agent.last_name ?? "");
  if (!first && !last) return false;

  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const nameWords = [...first.split(" "), ...last.split(" ")].filter(Boolean);
  const collapsedFirst = collapseSearchText(agent.first_name ?? "");
  const collapsedLast = collapseSearchText(agent.last_name ?? "");
  const collapsedFull = `${collapsedFirst}${collapsedLast}`;

  const tokenHits = (token: string) => {
    if (nameWords.some((word) => word.startsWith(token))) return true;
    if (collapsedFirst.startsWith(token) || collapsedLast.startsWith(token)) return true;
    // Multi-part collapsed full name (e.g. query "annemarie" vs first "Anne-Marie")
    if (token.length >= 3 && collapsedFull.startsWith(token)) return true;
    return false;
  };

  return tokens.every(tokenHits);
}
