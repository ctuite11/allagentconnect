export function normalizeAgentNamePart(value?: string | null): string {
  return (value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function hasUsableAgentName(agent: {
  first_name?: string | null;
  last_name?: string | null;
}): boolean {
  return Boolean(
    normalizeAgentNamePart(agent.first_name) && normalizeAgentNamePart(agent.last_name),
  );
}

export function hasUsableHeadshot(agent: { headshot_url?: string | null }): boolean {
  return Boolean(agent.headshot_url?.trim());
}

export function isVisibleInAgentNetwork(agent: {
  first_name?: string | null;
  last_name?: string | null;
  headshot_url?: string | null;
}): boolean {
  return hasUsableAgentName(agent) && hasUsableHeadshot(agent);
}

export const AGENT_NETWORK_DB_FILTERS = <
  T extends {
    not: (column: string, operator: string, value: string) => T;
    neq: (column: string, value: string) => T;
  },
>(
  query: T,
): T =>
  query
    .not("first_name", "is", null)
    .not("last_name", "is", null)
    .neq("first_name", "")
    .neq("last_name", "")
    .not("first_name", "match", "^[[:space:]]*$")
    .not("last_name", "match", "^[[:space:]]*$")
    .not("headshot_url", "is", null)
    .neq("headshot_url", "");
