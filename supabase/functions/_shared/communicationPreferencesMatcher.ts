// Shared, event-agnostic matcher for Communications-Center preferences.
//
// Rule (independent-dimension AND across configured dimensions):
//   - Location:      no saved geoRows → auto-pass. Otherwise OR across rows;
//                    each row matches when every populated field on the row
//                    equals the corresponding event field (normalized).
//                    ZIP sentinels 00000/00001 are treated as unpopulated.
//   - Price:         no saved min → no lower bound; no saved max → no upper
//                    bound. hasNoMin/hasNoMax also mean "no bound on that
//                    side" and never restrict. Event may supply a point
//                    (`price`) or a range (`minPrice`/`maxPrice`).
//   - Property type: empty saved list → auto-pass. Otherwise require a
//                    non-empty normalized intersection with event types.
//
// All-blank preferences → `anyDimensionConfigured=false`; callers treat that
// agent as preferences-unset (universal fallback bucket).

export interface SavedGeoRow {
  state?: string | null;
  county?: string | null;
  city?: string | null;
  zip_code?: string | null;
  neighborhood?: string | null;
}

export interface AgentPreferences {
  geoRows: SavedGeoRow[];
  minPrice: number | null;
  maxPrice: number | null;
  hasNoMin: boolean;
  hasNoMax: boolean;
  propertyTypes: string[];
}

export interface PreferenceEvent {
  state?: string | null;
  county?: string | null;
  city?: string | null;
  zip?: string | null;
  neighborhood?: string | null;
  price?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  propertyTypes?: string[] | null;
}

export type FailedDimension = "location" | "price" | "property_type";

export interface MatchResult {
  matches: boolean;
  anyDimensionConfigured: boolean;
  failedDimension?: FailedDimension;
  perDimension: {
    location: boolean;
    price: boolean;
    property_type: boolean;
  };
}

const ZIP_SENTINELS = new Set(["", "00000", "00001"]);

function norm(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function normZip(v: unknown): string {
  const s = norm(v);
  return ZIP_SENTINELS.has(s) ? "" : s;
}

function locationPasses(agent: AgentPreferences, event: PreferenceEvent): boolean {
  if (!agent.geoRows.length) return true;
  const eState = norm(event.state);
  const eCounty = norm(event.county);
  const eCity = norm(event.city);
  const eZip = normZip(event.zip);
  const eHood = norm(event.neighborhood);
  for (const r of agent.geoRows) {
    const rState = norm(r.state);
    const rCounty = norm(r.county);
    const rCity = norm(r.city);
    const rZip = normZip(r.zip_code);
    const rHood = norm(r.neighborhood);
    // A row with no populated fields cannot match anything.
    if (!rState && !rCounty && !rCity && !rZip && !rHood) continue;
    if (rState && rState !== eState) continue;
    if (rCounty && rCounty !== eCounty) continue;
    if (rCity && rCity !== eCity) continue;
    if (rZip && rZip !== eZip) continue;
    if (rHood && rHood !== eHood) continue;
    return true;
  }
  return false;
}

function pricePasses(agent: AgentPreferences, event: PreferenceEvent): boolean {
  const hasSavedMin = agent.minPrice != null;
  const hasSavedMax = agent.maxPrice != null;
  if (!hasSavedMin && !hasSavedMax) return true; // hasNoMin/hasNoMax alone do not restrict
  const savedMin = hasSavedMin ? (agent.minPrice as number) : Number.NEGATIVE_INFINITY;
  const savedMax = hasSavedMax ? (agent.maxPrice as number) : Number.POSITIVE_INFINITY;

  let eMin: number;
  let eMax: number;
  if (event.minPrice != null || event.maxPrice != null) {
    eMin = event.minPrice ?? Number.NEGATIVE_INFINITY;
    eMax = event.maxPrice ?? Number.POSITIVE_INFINITY;
  } else if (event.price != null) {
    eMin = event.price;
    eMax = event.price;
  } else {
    // Event carries no price info; cannot restrict.
    return true;
  }
  return savedMin <= eMax && eMin <= savedMax;
}

function propertyTypePasses(agent: AgentPreferences, event: PreferenceEvent): boolean {
  if (!agent.propertyTypes.length) return true;
  const savedLc = agent.propertyTypes.map(norm).filter(Boolean);
  if (!savedLc.length) return true;
  const eventLc = (event.propertyTypes ?? []).map(norm).filter(Boolean);
  if (!eventLc.length) return true; // event doesn't restrict on type
  return savedLc.some((t) => eventLc.includes(t));
}

export function matchesCommunicationPreferences(
  agent: AgentPreferences,
  event: PreferenceEvent,
): MatchResult {
  const hasLoc = agent.geoRows.length > 0;
  const hasPrice = agent.minPrice != null || agent.maxPrice != null;
  const hasTypes = agent.propertyTypes.length > 0;

  const location = locationPasses(agent, event);
  const price = pricePasses(agent, event);
  const property_type = propertyTypePasses(agent, event);

  const matches = location && price && property_type;
  let failedDimension: FailedDimension | undefined;
  if (!matches) {
    if (!location) failedDimension = "location";
    else if (!price) failedDimension = "price";
    else failedDimension = "property_type";
  }

  return {
    matches,
    anyDimensionConfigured: hasLoc || hasPrice || hasTypes,
    failedDimension,
    perDimension: { location, price, property_type },
  };
}

/** Empty preferences record — helpful default when an agent has no rows. */
export const EMPTY_PREFERENCES: AgentPreferences = {
  geoRows: [],
  minPrice: null,
  maxPrice: null,
  hasNoMin: false,
  hasNoMax: false,
  propertyTypes: [],
};