// County to cities mapping for filtering
import { MA_COUNTY_TOWNS } from "./maCountyTowns";
import { CT_COUNTY_TOWNS } from "./ctCountyTowns";
import { ME_COUNTY_TOWNS } from "./meCountyTowns";
import { NH_COUNTY_TOWNS } from "./nhCountyTowns";
import { RI_COUNTY_TOWNS } from "./riCountyTowns";
import { VT_COUNTY_TOWNS } from "./vtCountyTowns";

// Mapping of state + county to cities
export const COUNTY_TO_CITIES: Record<string, Record<string, string[]>> = {
  MA: MA_COUNTY_TOWNS,
  CT: CT_COUNTY_TOWNS,
  ME: ME_COUNTY_TOWNS,
  NH: NH_COUNTY_TOWNS,
  RI: RI_COUNTY_TOWNS,
  VT: VT_COUNTY_TOWNS,
};

// Get cities for a specific county in a state
export function getCitiesForCounty(state: string, county: string): string[] {
  if (!COUNTY_TO_CITIES[state]) {
    return [];
  }
  return COUNTY_TO_CITIES[state][county] || [];
}

// Check if a state has county-to-city mapping
export function hasCountyCityMapping(state: string): boolean {
  return state in COUNTY_TO_CITIES;
}
