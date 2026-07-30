export type AgentNetworkLocation = {
  formatted?: string;
  city?: string;
  state?: string;
  stateShort?: string;
  county?: string;
};

/**
 * Match a Places selection against agent service areas.
 *
 * Areas are stored as `"City, ST"` (coverage) or `"County, ST"` (county prefs).
 *
 * Critical: when a city (or county) is present, do NOT fall through to
 * whole-state matches — that made "Boston, MA" return every MA agent.
 */
export function agentMatchesNetworkLocation(
  serviceAreas: string[] | null | undefined,
  loc: AgentNetworkLocation,
): boolean {
  const areas = (serviceAreas || [])
    .map((a) => a.toLowerCase().trim())
    .filter(Boolean);
  if (areas.length === 0) return false;

  const city = loc.city?.toLowerCase().trim() ?? "";
  const county = loc.county?.toLowerCase().trim() ?? "";
  const stateShort = loc.stateShort?.toLowerCase().trim() ?? "";
  const stateLong = loc.state?.toLowerCase().trim() ?? "";
  const formatted = loc.formatted?.toLowerCase().trim() ?? "";

  const areaPrimary = (area: string) => area.split(",")[0]?.trim() ?? "";
  const areaState = (area: string) => {
    const parts = area.split(",").map((p) => p.trim());
    return parts.length > 1 ? parts[parts.length - 1] : "";
  };

  const stateMatches = (area: string) => {
    const st = areaState(area);
    if (stateShort && (st === stateShort || area.endsWith(`, ${stateShort}`))) return true;
    if (stateLong && (st === stateLong || area.endsWith(`, ${stateLong}`))) return true;
    return false;
  };

  const requireStateIfPresent = (area: string) => {
    if (!stateShort && !stateLong) return true;
    // Coverage/county rows usually include a state suffix; if missing, don't reject.
    if (!area.includes(",")) return true;
    return stateMatches(area);
  };

  /** Exact primary label, or primary equals / starts with "City …" as whole words. */
  const primaryMatchesLabel = (primary: string, label: string) => {
    if (!label) return false;
    if (primary === label) return true;
    if (primary.startsWith(`${label} `)) return true;
    return false;
  };

  // City selected → city-only (plus state when available). No state cascade.
  if (city) {
    return areas.some(
      (area) => primaryMatchesLabel(areaPrimary(area), city) && requireStateIfPresent(area),
    );
  }

  // County selected (no city) → county-only. No state cascade.
  if (county) {
    return areas.some((area) => {
      const primary = areaPrimary(area);
      const countyHit =
        primaryMatchesLabel(primary, county) ||
        primaryMatchesLabel(primary, `${county} county`) ||
        primary === `${county} county`;
      return countyHit && requireStateIfPresent(area);
    });
  }

  // State-only Places result
  if (stateShort || stateLong) {
    return areas.some((area) => stateMatches(area));
  }

  if (formatted) {
    return areas.some((area) => area.includes(formatted));
  }

  return false;
}
