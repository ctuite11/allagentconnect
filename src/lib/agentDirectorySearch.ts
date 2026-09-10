import { normalizeSearchText, collapseSearchText } from "@/lib/agentNetworkSearch";
import { matchesAgentName } from "@/lib/agentNameSearch";

/**
 * Agent Network directory search — matches agent name, brokerage/company and
 * team name(s). Team tiles match on team name and their brokerage.
 *
 * Team names come from every accepted `team_members` relationship for the agent
 * (canonical `teams.name`), plus the free-text `agent_profiles.team_name`.
 * Nothing here changes which team name a card displays.
 */
export type AgentDirectorySearchable = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
  /** All accepted canonical team names for this agent. */
  teamNames?: string[] | null;
  entity_type?: "agent" | "team";
};

function fieldMatches(value: string, tokens: string[]): boolean {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  const collapsed = collapseSearchText(value);
  return tokens.every((token) => normalized.includes(token) || collapsed.includes(token));
}

/** Every team name associated with the entity (canonical memberships + profile text). */
export function getEntityTeamNames(entity: AgentDirectorySearchable): string[] {
  const names = [...(entity.teamNames ?? []), entity.team_name ?? ""]
    .map((n) => (n ?? "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function brokerageFields(entity: AgentDirectorySearchable): string[] {
  return [entity.company ?? "", entity.office_name ?? ""].filter(Boolean);
}

/** The team name that caused the match, if the match came from a team name. */
export function matchedTeamName(
  entity: AgentDirectorySearchable,
  rawQuery: string,
): string | null {
  const query = normalizeSearchText(rawQuery ?? "");
  if (!query) return null;
  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  return getEntityTeamNames(entity).find((name) => fieldMatches(name, tokens)) ?? null;
}

export function matchesAgentDirectorySearch(
  entity: AgentDirectorySearchable,
  rawQuery: string,
): boolean {
  const query = normalizeSearchText(rawQuery ?? "");
  if (!query) return true;
  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const isTeam = entity.entity_type === "team";

  // Team tiles: team name (stored in first_name / team_name) + brokerage.
  if (isTeam) {
    const teamFields = [
      entity.first_name ?? "",
      ...getEntityTeamNames(entity),
      ...brokerageFields(entity),
    ].filter(Boolean);
    return teamFields.some((field) => fieldMatches(field, tokens));
  }

  if (matchesAgentName(entity, rawQuery)) return true;
  if (brokerageFields(entity).some((field) => fieldMatches(field, tokens))) return true;
  return matchedTeamName(entity, rawQuery) !== null;
}
