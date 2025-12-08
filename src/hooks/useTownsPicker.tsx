import { useState, useEffect, useMemo } from "react";
import { usCitiesByState } from "@/data/usCitiesData";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";
import { CT_COUNTY_TOWNS } from "@/data/ctCountyTowns";
import { RI_COUNTY_TOWNS } from "@/data/riCountyTowns";
import { NH_COUNTY_TOWNS } from "@/data/nhCountyTowns";
import { VT_COUNTY_TOWNS } from "@/data/vtCountyTowns";
import { ME_COUNTY_TOWNS } from "@/data/meCountyTowns";
import { US_STATES } from "@/data/usStatesCountiesData";
interface UseTownsPickerProps {
  state: string;
  county?: string;
  showAreas: boolean | string;
}

export function useTownsPicker({ state, county, showAreas }: UseTownsPickerProps) {
  console.log("[useTownsPicker] Hook initialized with:", { state, county, showAreas });
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Normalize state to 2-letter code
  const rawState = (state || "").trim();
  const stateKey = rawState && rawState.length > 2 
    ? (US_STATES.find(s => s.name.toLowerCase() === rawState.toLowerCase())?.code ?? rawState)
    : rawState?.toUpperCase();

  // New England states have county-to-towns mapping
  const hasCountyData = ["MA", "CT", "RI", "NH", "VT", "ME"].includes(stateKey || "");
  // Normalize county name by removing " County" suffix and trimming
  const normalizeCountyName = (countyName: string): string => {
    return countyName.replace(/\s+county$/i, '').trim();
  };

  // Get the county towns mapping for the current state
  const getCountyTowns = (countyName: string, stateCode: string): string[] => {
    const countyMap = {
      MA: MA_COUNTY_TOWNS,
      CT: CT_COUNTY_TOWNS,
      RI: RI_COUNTY_TOWNS,
      NH: NH_COUNTY_TOWNS,
      VT: VT_COUNTY_TOWNS,
      ME: ME_COUNTY_TOWNS
    }[stateCode];

    if (!countyMap) return [];

    // Normalize the input county name
    const normalizedInput = normalizeCountyName(countyName);

    // Try to find the county by comparing normalized names
    for (const [key, towns] of Object.entries(countyMap)) {
      if (normalizeCountyName(key).toLowerCase() === normalizedInput.toLowerCase()) {
        return towns;
      }
    }

    return [];
  };

  // Generate town list with neighborhoods
  const townsList = useMemo(() => {
    if (!stateKey) return [];
    
    // Build a base list of cities depending on county selection
    let baseCities: string[] = [];
    
    // For states with county data, use county mappings
    if (hasCountyData) {
      if (!county || county === "all") {
        // Get all towns from all counties for this state
        const countyMap = {
          MA: MA_COUNTY_TOWNS,
          CT: CT_COUNTY_TOWNS,
          RI: RI_COUNTY_TOWNS,
          NH: NH_COUNTY_TOWNS,
          VT: VT_COUNTY_TOWNS,
          ME: ME_COUNTY_TOWNS
        }[stateKey];
        
        if (countyMap) {
          const allTowns = new Set<string>();
          Object.values(countyMap).forEach(towns => {
            towns.forEach(town => allTowns.add(town));
          });
          baseCities = Array.from(allTowns).sort();
        }
      } else {
        baseCities = getCountyTowns(county, stateKey);
      }
    } else {
      // For states without county data, use the general cities list
      const currentStateCities = usCitiesByState[stateKey] || [];
      baseCities = currentStateCities;
    }

    // Only return the base cities - TownsPicker handles neighborhoods separately
    return baseCities;
  }, [state, county, showAreas]);

  const toggleCityExpansion = (city: string) => {
    console.log("[useTownsPicker] toggleCityExpansion called:", city);
    console.log("[useTownsPicker] Current expandedCities:", Array.from(expandedCities));
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(city)) {
        newSet.delete(city);
      } else {
        newSet.add(city);
      }
      console.log("[useTownsPicker] New expandedCities will be:", Array.from(newSet));
      return newSet;
    });
  };

  // Compute a full selection list including neighborhoods when requested
  const getAllTownsSelection = (includeAreas: boolean): string[] => {
    const selection = new Set<string>(townsList);
    if (!includeAreas) return Array.from(selection);

    // For each top-level city, include known neighborhoods and any hyphenated entries
    townsList.forEach((town) => {
      if (town.includes('-')) {
        selection.add(town);
        return;
      }
      const neighborhoodsFromData = getAreasForCity(town, stateKey || state) || [];
      let neighborhoods = neighborhoodsFromData;
      if ((neighborhoods?.length ?? 0) === 0) {
        neighborhoods = Array.from(new Set(
          townsList
            .filter((t) => t.startsWith(`${town}-`))
            .map((t) => t.split('-').slice(1).join('-'))
        ));
      }
      neighborhoods.forEach((n) => selection.add(`${town}-${n}`));
    });

    return Array.from(selection);
  };
  // Reset expanded cities when state/county changes (don't auto-expand, let user control)
  useEffect(() => {
    setExpandedCities(new Set());
  }, [state, county]);

  return {
    townsList,
    expandedCities,
    toggleCityExpansion,
    hasCountyData,
  };
}
