import { HOT_SHEET_FILTER_STATUSES } from "@/constants/status";

export interface HotSheetCriteriaCore {
  state: string;
  selectedCountyId: string;
  cities: string[];
  showAreas: boolean;
  propertyTypes: string[];
  statuses: string[];
  minPrice: string;
  maxPrice: string;
  hasNoMin: boolean;
  hasNoMax: boolean;
  bedrooms: string;
  bathrooms: string;
  rooms: string;
  acres: string;
  minSqft: string;
  maxSqft: string;
  pricePerSqft: string;
  hasParking: "yes" | "no" | "any";
}

export const DEFAULT_HOT_SHEET_STATUSES = ["coming_soon", "active", "off_market", "back_on_market"];
export const HOT_SHEET_STATUS_ORDER: readonly string[] = HOT_SHEET_FILTER_STATUSES.map((option) => option.value);

export const DEFAULT_HOT_SHEET_CRITERIA: HotSheetCriteriaCore = {
  state: "MA",
  selectedCountyId: "all",
  cities: [],
  showAreas: true,
  propertyTypes: [],
  statuses: DEFAULT_HOT_SHEET_STATUSES,
  minPrice: "",
  maxPrice: "",
  hasNoMin: false,
  hasNoMax: false,
  bedrooms: "",
  bathrooms: "",
  rooms: "",
  acres: "",
  minSqft: "",
  maxSqft: "",
  pricePerSqft: "",
  hasParking: "any",
};

const toStringValue = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return "";
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toNumber = (value: string): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInteger = (value: string): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeStatusSelection = (statuses: string[]): string[] => {
  const unique = Array.from(new Set(statuses));
  return unique.sort((a, b) => {
    const aIndex = HOT_SHEET_STATUS_ORDER.indexOf(a);
    const bIndex = HOT_SHEET_STATUS_ORDER.indexOf(b);
    const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return normalizedA - normalizedB;
  });
};

export const parkingToOption = (value: boolean | null | undefined): "yes" | "no" | "any" => {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "any";
};

export const optionToParking = (value: "yes" | "no" | "any"): boolean | null => {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
};

export const fromCriteriaPayload = (payload: unknown): HotSheetCriteriaCore => {
  const raw = (payload ?? {}) as Record<string, unknown>;

  return {
    ...DEFAULT_HOT_SHEET_CRITERIA,
    state: toStringValue(raw.state) || DEFAULT_HOT_SHEET_CRITERIA.state,
    selectedCountyId: toStringValue(raw.selectedCountyId) || toStringValue(raw.county) || DEFAULT_HOT_SHEET_CRITERIA.selectedCountyId,
    cities: toStringArray(raw.cities).length > 0 ? toStringArray(raw.cities) : toStringArray(raw.towns),
    showAreas: raw.showAreas !== false,
    propertyTypes: toStringArray(raw.propertyTypes),
    statuses: normalizeStatusSelection(toStringArray(raw.statuses).length > 0 ? toStringArray(raw.statuses) : DEFAULT_HOT_SHEET_STATUSES),
    minPrice: toStringValue(raw.minPrice),
    maxPrice: toStringValue(raw.maxPrice),
    hasNoMin: raw.hasNoMin === true,
    hasNoMax: raw.hasNoMax === true,
    bedrooms: toStringValue(raw.bedrooms),
    bathrooms: toStringValue(raw.bathrooms),
    rooms: toStringValue(raw.rooms),
    acres: toStringValue(raw.acres),
    minSqft: toStringValue(raw.minSqft),
    maxSqft: toStringValue(raw.maxSqft),
    pricePerSqft: toStringValue(raw.pricePerSqft),
    hasParking:
      raw.hasParking === "yes" || raw.hasParking === "no" || raw.hasParking === "any"
        ? raw.hasParking
        : parkingToOption(raw.hasParking as boolean | null | undefined),
  };
};

export const toCriteriaPayload = (criteria: HotSheetCriteriaCore) => ({
  state: criteria.state || null,
  selectedCountyId: criteria.selectedCountyId && criteria.selectedCountyId !== "all" ? criteria.selectedCountyId : null,
  county: criteria.selectedCountyId && criteria.selectedCountyId !== "all" ? criteria.selectedCountyId : null,
  cities: criteria.cities.length > 0 ? criteria.cities : null,
  showAreas: criteria.showAreas,
  propertyTypes: criteria.propertyTypes.length > 0 ? criteria.propertyTypes : null,
  statuses: criteria.statuses.length > 0 ? normalizeStatusSelection(criteria.statuses) : null,
  minPrice: criteria.hasNoMin ? null : toNumber(criteria.minPrice),
  maxPrice: criteria.hasNoMax ? null : toNumber(criteria.maxPrice),
  hasNoMin: criteria.hasNoMin,
  hasNoMax: criteria.hasNoMax,
  bedrooms: toInteger(criteria.bedrooms),
  bathrooms: toNumber(criteria.bathrooms),
  // `rooms` is deliberately NOT persisted: there is no listings.rooms column,
  // so the Hot Sheet matcher cannot enforce it and stored values would produce
  // false-positive emails. Existing saved values fail closed server-side.
  acres: toNumber(criteria.acres),
  minSqft: toInteger(criteria.minSqft),
  maxSqft: toInteger(criteria.maxSqft),
  pricePerSqft: toNumber(criteria.pricePerSqft),
  hasParking: optionToParking(criteria.hasParking),
});
