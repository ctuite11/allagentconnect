export function setPrimaryAgentId(agentId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("primary_agent_id", agentId);
  document.cookie = `primary_agent_id=${agentId}; path=/; max-age=7776000`;
}

export function getPrimaryAgentId(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Try localStorage first
  const lsValue = window.localStorage.getItem("primary_agent_id");
  if (lsValue) return lsValue;

  // 2. Fallback to cookie
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("primary_agent_id="));

  if (!cookie) return null;

  return cookie.split("=")[1] || null;
}

export function clearPrimaryAgentId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("primary_agent_id");
  document.cookie = "primary_agent_id=; path=/; max-age=0";
  document.cookie = "primary_agent_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
