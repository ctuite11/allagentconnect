import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronDown, ChevronUp, MapPin, ChevronRight } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
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

  const { townsList, hasCountyData } = useTownsPicker({
    state,
    county,
    showAreas,
  });

  const currentStateCounties = hasCountyData ? getCountiesForState(state) : [];

  const getStateName = (code: string) => {
    return US_STATES.find(s => s.code === code)?.name || code;
  };

  const rawState = (state || "").trim();
  const stateKey = rawState && rawState.length > 2 
    ? (US_STATES.find(s => s.name.toLowerCase() === rawState.toLowerCase())?.code ?? rawState)
    : rawState?.toUpperCase();

  const updateValue = (updates: Partial<GeographicSelection>) => {
    onChange({ ...value, ...updates });
  };

  const toggleTown = (town: string) => {
    if (town.includes('-')) {
      // Neighborhood selection - DO NOT auto-select parent city
      if (!selectedTowns.includes(town)) {
        updateValue({ towns: [...selectedTowns, town] });
      } else {
        updateValue({ towns: selectedTowns.filter(t => t !== town) });
      }
    } else {
      // City selection
      if (selectedTowns.includes(town)) {
        // Remove city and all its neighborhoods
        updateValue({ towns: selectedTowns.filter(t => !t.startsWith(`${town}-`) && t !== town) });
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

  const topLevelTowns = townsList.filter(t => !t.includes('-'));

  const handleSelectAll = () => {
    const allSelected = topLevelTowns.every(t => selectedTowns.includes(t));
    if (allSelected) {
      updateValue({ towns: [] });
    } else {
      updateValue({ towns: topLevelTowns });
    }
  };

  const getSummary = () => {
    if (collapsedSummary) return collapsedSummary;
    if (selectedTowns.length === 0) return "All areas";
    if (selectedTowns.length === 1) return selectedTowns[0];
    return `${selectedTowns.length} areas selected`;
  };

  const isBostonSelected = selectedTowns.includes("Boston");

  // Get neighborhoods for a city
  const getNeighborhoods = (city: string): string[] => {
    const neighborhoodsFromData = getAreasForCity(city, stateKey || state) || [];
    if (neighborhoodsFromData.length > 0) return neighborhoodsFromData;
    // Check townsList for hyphenated entries
    return townsList
      .filter(t => t.startsWith(`${city}-`))
      .map(t => t.split('-').slice(1).join('-'));
  };

  const content = (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {/* State Selection */}
      <div className="space-y-2">
        <Label className={compact ? "text-xs" : undefined}>State</Label>
        <Select
          value={state}
          onValueChange={(newState) => updateValue({ state: newState, county: "all", towns: [] })}
        >
          <SelectTrigger>
            <SelectValue>{getStateName(state)}</SelectValue>
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

      {/* Boston Badge */}
      {isBostonSelected && (
        <Badge variant="secondary" className="w-full justify-center py-2">
          Selecting Boston includes all neighborhoods unless you select specific ones
        </Badge>
      )}

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
                  checked={topLevelTowns.length > 0 && topLevelTowns.every(t => selectedTowns.includes(t))}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                  Select All ({topLevelTowns.length})
                </label>
              </div>
            </div>
            <ScrollArea className="h-[250px]">
              <div className="p-2 space-y-1">
                {topLevelTowns.length > 0 ? (
                  topLevelTowns.map((town) => {
                    const isSelected = selectedTowns.includes(town);
                    const neighborhoods = showAreas ? getNeighborhoods(town) : [];
                    const hasNeighborhoods = neighborhoods.length > 0;
                    const isExpanded = expandedCities.has(town);

                    return (
                      <div key={town}>
                        <div className="flex items-center space-x-2 py-1.5 px-1 rounded hover:bg-accent">
                          {hasNeighborhoods && (
                            <button
                              type="button"
                              onClick={() => toggleCityExpand(town)}
                              className="p-0.5 hover:bg-accent rounded"
                            >
                              <ChevronRight className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )} />
                            </button>
                          )}
                          {!hasNeighborhoods && <div className="w-5" />}
                          <Checkbox
                            id={`town-${town}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleTown(town)}
                          />
                          <label 
                            htmlFor={`town-${town}`} 
                            className="text-sm cursor-pointer flex-1"
                          >
                            {town}
                          </label>
                        </div>
                        
                        {/* Neighborhoods */}
                        {hasNeighborhoods && isExpanded && (
                          <div className="ml-7 pl-2 border-l space-y-1">
                            {neighborhoods.map((neighborhood) => {
                              const neighborhoodKey = `${town}-${neighborhood}`;
                              const isNeighborhoodSelected = selectedTowns.includes(neighborhoodKey);
                              
                              return (
                                <div 
                                  key={neighborhoodKey}
                                  className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-accent"
                                >
                                  <Checkbox
                                    id={`neighborhood-${neighborhoodKey}`}
                                    checked={isNeighborhoodSelected}
                                    onCheckedChange={() => toggleTown(neighborhoodKey)}
                                  />
                                  <label 
                                    htmlFor={`neighborhood-${neighborhoodKey}`} 
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
        
        {/* Selected Towns Pills */}
        {selectedTowns.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedTowns.map((town) => {
              const isNeighborhood = town.includes('-');
              const displayName = isNeighborhood 
                ? `${town.split('-')[0]} – ${town.split('-').slice(1).join('-')}`
                : town;
              
              return (
                <div
                  key={town}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <span className="text-primary">{displayName}</span>
                  <button
                    type="button"
                    onClick={() => toggleTown(town)}
                    className="text-primary/70 hover:text-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
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
