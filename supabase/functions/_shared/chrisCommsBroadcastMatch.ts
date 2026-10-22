import {
  matchesCommunicationPreferences,
  type AgentPreferences,
} from "./communicationPreferencesMatcher.ts";

interface ParsedBroadcastCriteria {
  state: string | null;
  cities: string[];
  counties: string[];
  neighborhoods: string[];
  min_price: number | null;
  max_price: number | null;
  property_types: string[];
}

const ACCOUNT_ID = "1fc50da1-2664-4931-8cab-64e24dc5ed8c";
const ACCOUNT_EMAIL = "chris@allagentconnect.com";
const norm = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const countyKey = (value: unknown): string => norm(value).replace(/ county$/, "");

/**
 * Account-only supplement for future core Communications broadcasts.
 * Boston, MA belongs to Suffolk County independently of saved preferences.
 * Original counties must all agree; never infer city/county pairs for other towns.
 * This is not an eligibility override: callers retain opt-in, sender, pause,
 * suppression, cadence and dedup gates. Non-target accounts return verbatim.
 */
export function chrisCommsBroadcastMatch(
  agent: { agent_id: string; email: string; savedPrefs: AgentPreferences },
  criteria: ParsedBroadcastCriteria,
  originalMatch: boolean,
): boolean {
  if (agent.agent_id !== ACCOUNT_ID || norm(agent.email) !== ACCOUNT_EMAIL || originalMatch) {
    return originalMatch;
  }
  if (norm(criteria.state) !== "ma" || !criteria.cities.some((city) => norm(city) === "boston")) {
    return originalMatch;
  }
  // Read the original payload, not split events: ambiguous/conflicting counties
  // cannot acquire a match through a county-less Boston event.
  if (criteria.counties.some((county) => countyKey(county) !== "suffolk")) return originalMatch;

  const rows = agent.savedPrefs.geoRows.filter((row) =>
    norm(row.state) === "ma" && norm(row.city) === "boston" && countyKey(row.county) === "suffolk"
  );
  if (!rows.length) return originalMatch;

  return matchesCommunicationPreferences(
    { ...agent.savedPrefs, geoRows: rows.map((row) => ({ ...row, county: "Suffolk" })) },
    {
      state: "MA",
      city: "Boston",
      county: "Suffolk",
      minPrice: criteria.min_price,
      maxPrice: criteria.max_price,
      propertyTypes: criteria.property_types,
    },
  ).matches;
}