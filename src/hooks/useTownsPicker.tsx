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

    const towns: string[] = [];
    const shouldShowAreas = showAreas === true || showAreas === "yes" || showAreas === "true" || showAreas === "1";

    baseCities.forEach((city) => {
      towns.push(city);
      if (shouldShowAreas) {
        const neighborhoods = getAreasForCity(city, stateKey || state);
        neighborhoods.forEach((neighborhood) => {
          towns.push(`${city}-${neighborhood}`);
        });
      }
    });

    return towns;
  }, [state, county, showAreas]);

  const toggleCityExpansion = (city: string) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(city)) {
        newSet.delete(city);
      } else {
        newSet.add(city);
      }
      return newSet;
    });
  };

  // Reset expanded cities when state or county changes
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
