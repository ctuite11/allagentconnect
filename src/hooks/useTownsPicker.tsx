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

    return countyMap?.[countyName] || [];
  };

  // Generate town list with neighborhoods
  const townsList = useMemo(() => {
    if (!stateKey) return [];

    const currentStateCities = usCitiesByState[stateKey || state] || [];
    
    // Build a base list of cities depending on county selection
    let baseCities: string[] = [];
    if (!county || county === "all") {
      baseCities = currentStateCities;
    } else {
      baseCities = getCountyTowns(county, stateKey || state);
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
