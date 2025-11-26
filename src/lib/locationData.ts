// Unified location data utility for all US states
import { COUNTY_TO_CITIES, getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { getCountiesForState } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";

export interface CityOption {
  name: string;
  source: 'county' | 'state' | 'fallback';
}

/**
 * Get cities for a given state and optional county
 * Returns cities sorted alphabetically with "Other" at the end
 */
export function getCitiesForStateAndCounty(state: string, county?: string | null): CityOption[] {
  let cities: string[] = [];
  let source: 'county' | 'state' | 'fallback' = 'fallback';

  // If county is provided and we have county-to-city mapping for this state
  if (county && county !== 'all' && hasCountyCityMapping(state)) {
    const countyCities = getCitiesForCounty(state, county);
    if (countyCities.length > 0) {
      cities = countyCities;
      source = 'county';
    }
  }

  // Fallback to state-level cities if no county cities found
  if (cities.length === 0 && usCitiesByState[state]) {
    cities = usCitiesByState[state];
    source = 'state';
  }

  // Always add "Other" as fallback option
  const cityOptions: CityOption[] = [
    ...cities.map(name => ({ name, source })),
    { name: 'Other', source: 'fallback' }
  ];

  // Sort alphabetically, keeping "Other" at the end
  return cityOptions.sort((a, b) => {
    if (a.name === 'Other') return 1;
    if (b.name === 'Other') return -1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get neighborhoods for a city/state combination
 * Returns empty array if no neighborhood data exists
 */
export function getNeighborhoodsForLocation(params: {
  city?: string;
  state?: string;
  county?: string;
}): string[] {
  const { city, state } = params;
  
  if (!city || !state) {
    return [];
  }

  // Check if we have neighborhood data for this city/state
  if (hasNeighborhoodData(city, state)) {
    return getAreasForCity(city, state);
  }

  return [];
}

/**
 * Validate if a city exists in the available options for a state/county
 * Returns the matched city name (with proper casing) or null
 */
export function validateAndNormalizeCity(
  cityToCheck: string,
  state: string,
  county?: string | null
): string | null {
  const availableCities = getCitiesForStateAndCounty(state, county);
  const normalized = cityToCheck.trim().toLowerCase();
  
  const matched = availableCities.find(
    c => c.name.toLowerCase() === normalized && c.name !== 'Other'
  );
  
  return matched ? matched.name : null;
}

/**
 * Check if a state/county/city combination is valid
 * Returns { isValid: boolean, message?: string }
 */
export function validateLocationCombo(params: {
  state?: string;
  county?: string;
  city?: string;
}): { isValid: boolean; message?: string } {
  const { state, county, city } = params;

  if (!state || !city) {
    return { isValid: true }; // Can't validate incomplete data
  }

  // For states with county mapping, validate county + city combo
  if (hasCountyCityMapping(state) && county && county !== 'all') {
    const countyCities = getCitiesForCounty(state, county);
    const cityMatch = countyCities.find(
      c => c.toLowerCase() === city.toLowerCase()
    );
    
    if (!cityMatch && city !== 'Other') {
      return {
        isValid: false,
        message: `${city} does not belong to ${county} County in ${state}. Please verify your selection.`
      };
    }
  }

  return { isValid: true };
}
