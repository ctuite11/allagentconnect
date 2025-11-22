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
