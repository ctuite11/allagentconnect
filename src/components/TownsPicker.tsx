import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";
import { US_STATES } from "@/data/usStatesCountiesData";

interface TownsPickerProps {
  towns: string[];
  selectedTowns: string[];
  onToggleTown: (town: string) => void;
  expandedCities: Set<string>;
  onToggleCityExpansion: (city: string) => void;
  state: string;
  searchQuery?: string;
  variant?: "checkbox" | "button";
}

export function TownsPicker({
  towns,
  selectedTowns,
  onToggleTown,
  expandedCities,
  onToggleCityExpansion,
  state,
  searchQuery = "",
  variant = "checkbox"
}: TownsPickerProps) {
  const rawState = (state || "").trim();
  const stateKey = rawState && rawState.length > 2 
    ? (US_STATES.find(s => s.name.toLowerCase() === rawState.toLowerCase())?.code ?? rawState)
    : rawState?.toUpperCase();

  const filteredTowns = towns.filter(town => 
    town.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const topCities = new Set(filteredTowns.filter(t => !t.includes('-')));


  if (variant === "button") {
    return (
      <div className="space-y-1">
        {filteredTowns.map((town) => {
          // Check if this is a neighborhood entry (contains hyphen)
          if (town.includes('-')) return null;

          const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
          let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
          if ((neighborhoods?.length ?? 0) === 0) {
            neighborhoods = Array.from(new Set(
              towns
                .filter((t) => t.startsWith(`${town}-`))
                .map((t) => t.split('-').slice(1).join('-'))
            ));
          }
          const isExpanded = expandedCities.has(town);
          
          return (
            <div key={town} className="space-y-1">
              <div className="flex items-center">
                {hasNeighborhoods && (
                  <button
                    type="button"
                    onClick={() => onToggleCityExpansion(town)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleTown(town)}
                  className="flex-1 text-left px-2 py-1.5 text-sm hover:bg-muted rounded"
                >
                  {town}, {state}
                </button>
              </div>
              {hasNeighborhoods && isExpanded && (
                <div className="ml-8 border-l-2 border-muted pl-2 mt-1 bg-muted/30 rounded-r py-1 space-y-1">
                  {neighborhoods
                    .filter((n) => !topCities.has(n))
                    .map((neighborhood) => (
                    <button
                      key={`${town}-${neighborhood}`}
                      type="button"
                      onClick={() => onToggleTown(`${town}-${neighborhood}`)}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-muted rounded text-muted-foreground"
                    >
                      {neighborhood}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Checkbox variant (BrowseProperties style)
  return (
    <div className="space-y-1">
      {filteredTowns.map((town) => {
        // Check if this is a neighborhood entry (contains hyphen)
        if (town.includes('-')) return null;

        const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
        let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
        // Fallback: if dataset lookup fails, derive from provided towns list (city-neighborhood)
        if ((neighborhoods?.length ?? 0) === 0) {
          neighborhoods = Array.from(new Set(
            towns
              .filter((t) => t.startsWith(`${town}-`))
              .map((t) => t.split('-').slice(1).join('-'))
          ));
        }
        const isExpanded = expandedCities.has(town);
        
        return (
          <div key={town} className="space-y-1">
            <div className="flex items-center space-x-2 py-0.5">
              {hasNeighborhoods && (
                <button
                  type="button"
                  onClick={() => onToggleCityExpansion(town)}
                  className="p-1 hover:bg-muted rounded"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                </button>
              )}
              <Checkbox
                id={`town-${town}`}
                checked={selectedTowns.includes(town)}
                onCheckedChange={() => onToggleTown(town)}
              />
              <label htmlFor={`town-${town}`} className="text-sm cursor-pointer flex-1">{town}</label>
            </div>
            {hasNeighborhoods && isExpanded && (
              <div className="ml-8 border-l-2 border-muted pl-2 space-y-1 bg-muted/30 rounded-r py-1">
                {neighborhoods
                  .filter((n) => !topCities.has(n))
                  .map((neighborhood) => (
                  <div key={`${town}-${neighborhood}`} className="flex items-center space-x-2 py-0.5">
                    <Checkbox
                      id={`neighborhood-${town}-${neighborhood}`}
                      checked={selectedTowns.includes(`${town}-${neighborhood}`)}
                      onCheckedChange={() => onToggleTown(`${town}-${neighborhood}`)}
                    />
                    <label htmlFor={`neighborhood-${town}-${neighborhood}`} className="text-xs cursor-pointer flex-1 text-muted-foreground">
                      {neighborhood}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
