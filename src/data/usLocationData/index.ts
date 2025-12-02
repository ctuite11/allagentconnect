import { StateData, LocationEntry, CityData } from './types';
import { northeastStates } from './northeast';
import { southeastStates } from './southeast';
import { midwestStates } from './midwest';
import { westStates } from './west';

// Combined array of all states
export const allStates: StateData[] = [
  ...northeastStates,
  ...southeastStates,
  ...midwestStates,
  ...westStates
];

// Export individual regions for selective imports
export { northeastStates, southeastStates, midwestStates, westStates };

// Export types
export type { StateData, LocationEntry, CityData };

// Helper function to get all locations as flat array
export function getAllLocations(): LocationEntry[] {
  const locations: LocationEntry[] = [];
  
  for (const state of allStates) {
    for (const city of state.cities) {
      if (city.neighborhoods && city.neighborhoods.length > 0) {
        for (const neighborhood of city.neighborhoods) {
          locations.push({
            state: state.name,
            stateAbbr: state.abbreviation,
            city: city.name,
            neighborhood,
            zipCodes: city.zipCodes
          });
        }
      } else {
        locations.push({
          state: state.name,
          stateAbbr: state.abbreviation,
          city: city.name,
          zipCodes: city.zipCodes
        });
      }
    }
  }
  
  return locations;
}

// Helper function to get state by abbreviation
export function getStateByAbbreviation(abbr: string): StateData | undefined {
  return allStates.find(state => state.abbreviation.toLowerCase() === abbr.toLowerCase());
}

// Helper function to get cities for a state
export function getCitiesForState(stateAbbr: string): CityData[] {
  const state = getStateByAbbreviation(stateAbbr);
  return state?.cities || [];
}

// Helper function to get zip codes for a city
export function getZipCodesForCity(stateAbbr: string, cityName: string): string[] {
  const state = getStateByAbbreviation(stateAbbr);
  if (!state) return [];
  
  const city = state.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city?.zipCodes || [];
}

// Helper function to get neighborhoods for a city
export function getNeighborhoodsForCity(stateAbbr: string, cityName: string): string[] {
  const state = getStateByAbbreviation(stateAbbr);
  if (!state) return [];
  
  const city = state.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city?.neighborhoods || [];
}

// Helper function to search locations by query
export function searchLocations(query: string, limit = 20): LocationEntry[] {
  const lowerQuery = query.toLowerCase();
  const results: LocationEntry[] = [];
  
  for (const state of allStates) {
    if (results.length >= limit) break;
    
    for (const city of state.cities) {
      if (results.length >= limit) break;
      
      const cityMatches = city.name.toLowerCase().includes(lowerQuery);
      const stateMatches = state.name.toLowerCase().includes(lowerQuery) || 
                          state.abbreviation.toLowerCase().includes(lowerQuery);
      const zipMatches = city.zipCodes.some(zip => zip.startsWith(lowerQuery));
      
      if (cityMatches || stateMatches || zipMatches) {
        results.push({
          state: state.name,
          stateAbbr: state.abbreviation,
          city: city.name,
          zipCodes: city.zipCodes
        });
      }
      
      // Also check neighborhoods
      if (city.neighborhoods) {
        for (const neighborhood of city.neighborhoods) {
          if (results.length >= limit) break;
          
          if (neighborhood.toLowerCase().includes(lowerQuery)) {
            results.push({
              state: state.name,
              stateAbbr: state.abbreviation,
              city: city.name,
              neighborhood,
              zipCodes: city.zipCodes
            });
          }
        }
      }
    }
  }
  
  return results;
}

// Helper function to get all state abbreviations
export function getAllStateAbbreviations(): string[] {
  return allStates.map(state => state.abbreviation);
}

// Helper function to get all state names
export function getAllStateNames(): string[] {
  return allStates.map(state => state.name);
}
