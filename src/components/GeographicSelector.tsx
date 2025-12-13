import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronDown, ChevronUp, MapPin, ChevronRight } from "lucide-react";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";
import { CT_COUNTY_TOWNS } from "@/data/ctCountyTowns";
import { RI_COUNTY_TOWNS } from "@/data/riCountyTowns";
import { NH_COUNTY_TOWNS } from "@/data/nhCountyTowns";
import { VT_COUNTY_TOWNS } from "@/data/vtCountyTowns";
import { ME_COUNTY_TOWNS } from "@/data/meCountyTowns";
import { usCitiesByState } from "@/data/usCitiesData";
import { cn } from "@/lib/utils";

export interface GeographicSelection {
  state: string;
  county: string;
  towns: string[];
  showAreas: boolean;
}

interface GeographicSelectorProps {
  value: GeographicSelection;
  onChange: (value: GeographicSelection) => void;
  defaultCollapsed?: boolean;
  label?: string;
  description?: string;
  showWrapper?: boolean;
  collapsedSummary?: string;
  className?: string;
  compact?: boolean;
}

// New England states with county-to-towns mapping
const NEW_ENGLAND_STATES = ["MA", "CT", "RI", "NH", "VT", "ME"];

const COUNTY_MAPS: Record<string, Record<string, string[]>> = {
  MA: MA_COUNTY_TOWNS,
  CT: CT_COUNTY_TOWNS,
  RI: RI_COUNTY_TOWNS,
  NH: NH_COUNTY_TOWNS,
  VT: VT_COUNTY_TOWNS,
  ME: ME_COUNTY_TOWNS,
};

export function GeographicSelector({
  value,
  onChange,
  defaultCollapsed = true,
  label = "Location",
  description,
  showWrapper = true,
  collapsedSummary,
  className,
  compact = false,
}: GeographicSelectorProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [townsPopoverOpen, setTownsPopoverOpen] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const state = value.state || "MA";
  const county = value.county || "all";
  const selectedTowns = value.towns || [];
  const showAreas = value.showAreas !== false;

  // Normalize state to 2-letter code
  const stateCode = useMemo(() => {
    const raw = (state || "").trim();
    if (raw.length > 2) {
      return US_STATES.find(s => s.name.toLowerCase() === raw.toLowerCase())?.code ?? raw.toUpperCase();
    }
    return raw.toUpperCase();
  }, [state]);

  const hasCountyData = NEW_ENGLAND_STATES.includes(stateCode);
  const currentStateCounties = hasCountyData ? getCountiesForState(stateCode) : [];

  // Build towns list directly from data sources - NO LEGACY HOOK
  const townsList = useMemo(() => {
    if (!stateCode) return [];

    let baseCities: string[] = [];

    if (hasCountyData) {
      const countyMap = COUNTY_MAPS[stateCode];
      if (countyMap) {
        if (!county || county === "all") {
          // Get all towns from all counties for this state
          const allTowns = new Set<string>();
          Object.values(countyMap).forEach(towns => {
            towns.forEach(town => allTowns.add(town));
          });
          baseCities = Array.from(allTowns);
        } else {
          // Get towns for specific county (handle " County" suffix)
          const normalizedCounty = county.replace(/\s+county$/i, '').trim().toLowerCase();
          for (const [key, towns] of Object.entries(countyMap)) {
            if (key.replace(/\s+county$/i, '').trim().toLowerCase() === normalizedCounty) {
              baseCities = towns;
              break;
            }
          }
        }
      }
    } else {
      // For states without county data, use general cities list
      baseCities = usCitiesByState[stateCode] || [];
    }

    // Return ONLY base cities, sorted - NO hyphenated entries
    return baseCities.filter(city => !city.includes('-')).sort();
  }, [stateCode, county, hasCountyData]);

  const getStateName = (code: string) => {
    return US_STATES.find(s => s.code === code)?.name || code;
  };

  const updateValue = (updates: Partial<GeographicSelection>) => {
    onChange({ ...value, ...updates });
  };

  // Clean toggle logic - no hyphenated synthetic entries
  const toggleTown = (town: string, isNeighborhood: boolean = false, parentCity?: string) => {
    if (isNeighborhood && parentCity) {
      // Neighborhood selection - store as "City-Neighborhood"
      const neighborhoodKey = `${parentCity}-${town}`;
      if (selectedTowns.includes(neighborhoodKey)) {
        updateValue({ towns: selectedTowns.filter(t => t !== neighborhoodKey) });
      } else {
        updateValue({ towns: [...selectedTowns, neighborhoodKey] });
      }
    } else {
      // City selection
      if (selectedTowns.includes(town)) {
        // Remove city AND all its neighborhoods
        updateValue({ 
          towns: selectedTowns.filter(t => t !== town && !t.startsWith(`${town}-`)) 
        });
      } else {
        updateValue({ towns: [...selectedTowns, town] });
      }
    }
  };

  const toggleCityExpand = (city: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
      } else {
        next.add(city);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allSelected = townsList.every(t => selectedTowns.includes(t));
    if (allSelected) {
      updateValue({ towns: [] });
    } else {
      // Select all cities only, not neighborhoods
      updateValue({ towns: [...townsList] });
    }
  };

  const getSummary = () => {
    if (collapsedSummary) return collapsedSummary;
    if (selectedTowns.length === 0) return "All areas";
    if (selectedTowns.length === 1) {
      const town = selectedTowns[0];
      if (town.includes('-')) {
        const [city, ...rest] = town.split('-');
        return `${city} – ${rest.join('-')}`;
      }
      return town;
    }
    return `${selectedTowns.length} areas selected`;
  };

  // Get neighborhoods for a city from the data source
  const getNeighborhoods = (city: string): string[] => {
    return getAreasForCity(city, stateCode) || [];
  };

  // Check if a specific neighborhood is selected
  const isNeighborhoodSelected = (city: string, neighborhood: string): boolean => {
    return selectedTowns.includes(`${city}-${neighborhood}`);
  };

  // Format display name for pills
  const getDisplayName = (town: string): string => {
    if (town.includes('-')) {
      const [city, ...rest] = town.split('-');
      return `${city} – ${rest.join('-')}`;
    }
    return town;
  };

  const content = (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {/* State Selection */}
      <div className="space-y-2">
        <Label className={compact ? "text-xs" : undefined}>State</Label>
        <Select
          value={stateCode}
          onValueChange={(newState) => updateValue({ state: newState, county: "all", towns: [] })}
        >
          <SelectTrigger>
            <SelectValue>{getStateName(stateCode)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="z-50 max-h-[300px]">
            {US_STATES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* County Selection */}
      {hasCountyData && (
        <div className="space-y-2">
          <Label className={compact ? "text-xs" : undefined}>County</Label>
          <Select 
            value={county} 
            onValueChange={(newCounty) => updateValue({ county: newCounty, towns: [] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 max-h-[300px]">
              <SelectItem value="all">All Counties</SelectItem>
              {currentStateCounties.map((countyName) => (
                <SelectItem key={countyName} value={countyName}>
                  {countyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Show Areas Toggle */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="showAreas"
          checked={showAreas}
          onCheckedChange={(checked) => updateValue({ showAreas: !!checked })}
        />
        <label htmlFor="showAreas" className={cn("cursor-pointer", compact ? "text-xs" : "text-sm")}>
          Include neighborhoods/areas
        </label>
      </div>

      {/* Town Selection - Popover with Checkbox List */}
      <div className="space-y-2">
        <Label className={compact ? "text-xs" : undefined}>Towns & Cities</Label>
        <Popover open={townsPopoverOpen} onOpenChange={setTownsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={townsPopoverOpen}
              className="w-full justify-between font-normal"
            >
              {selectedTowns.length > 0 
                ? `${selectedTowns.length} selected` 
                : "Select towns..."}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 z-50" align="start">
            <div className="p-2 border-b">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="selectAll"
                  checked={townsList.length > 0 && townsList.every(t => selectedTowns.includes(t))}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                  Select All ({townsList.length})
                </label>
              </div>
            </div>
            <ScrollArea className="h-[250px]">
              <div className="p-2 space-y-1">
                {townsList.length > 0 ? (
                  townsList.map((city) => {
                    const isSelected = selectedTowns.includes(city);
                    const neighborhoods = showAreas ? getNeighborhoods(city) : [];
                    const hasNeighborhoods = neighborhoods.length > 0;
                    const isExpanded = expandedCities.has(city);

                    return (
                      <div key={city}>
                        <div className="flex items-center space-x-2 py-1.5 px-1 rounded hover:bg-accent">
                          {hasNeighborhoods ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCityExpand(city);
                              }}
                              className="p-0.5 hover:bg-accent rounded"
                            >
                              <ChevronRight className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )} />
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          <Checkbox
                            id={`city-${city}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleTown(city)}
                          />
                          <label 
                            htmlFor={`city-${city}`} 
                            className="text-sm cursor-pointer flex-1"
                          >
                            {city}
                            {hasNeighborhoods && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({neighborhoods.length})
                              </span>
                            )}
                          </label>
                        </div>
                        
                        {/* Neighborhoods - rendered inside popover when expanded */}
                        {hasNeighborhoods && isExpanded && (
                          <div className="ml-7 pl-2 border-l border-border space-y-1 my-1">
                            {neighborhoods.map((neighborhood) => {
                              const isNSelected = isNeighborhoodSelected(city, neighborhood);
                              
                              return (
                                <div 
                                  key={`${city}-${neighborhood}`}
                                  className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-accent"
                                >
                                  <Checkbox
                                    id={`neighborhood-${city}-${neighborhood}`}
                                    checked={isNSelected}
                                    onCheckedChange={() => toggleTown(neighborhood, true, city)}
                                  />
                                  <label 
                                    htmlFor={`neighborhood-${city}-${neighborhood}`} 
                                    className="text-sm cursor-pointer text-muted-foreground"
                                  >
                                    {neighborhood}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No towns available
                  </p>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        
        {/* Selected Towns Pills - only display, no duplicate counter */}
        {selectedTowns.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedTowns.map((town) => (
              <div
                key={town}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-full text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <span className="text-foreground">{getDisplayName(town)}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (town.includes('-')) {
                      const [city, ...rest] = town.split('-');
                      toggleTown(rest.join('-'), true, city);
                    } else {
                      toggleTown(town);
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateValue({ towns: [] })}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (!showWrapper) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="bg-card rounded-lg shadow-sm border">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{label.toUpperCase()}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isOpen && (
              <span className="text-xs text-muted-foreground">{getSummary()}</span>
            )}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={cn("p-4 border-t", compact && "p-3")}>
            {description && (
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
            )}
            {content}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default GeographicSelector;
