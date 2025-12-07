import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";
import { cn } from "@/lib/utils";

export interface GeographicSelection {
  state: string;
  county: string;
  towns: string[];
  showAreas: boolean;
}

interface GeographicSelectorProps {
  /** Current selection state */
  value: GeographicSelection;
  /** Callback when selection changes */
  onChange: (value: GeographicSelection) => void;
  /** Whether to start collapsed (default: true) */
  defaultCollapsed?: boolean;
  /** Label for the section header */
  label?: string;
  /** Description text */
  description?: string;
  /** Whether to show the collapsible wrapper (default: true) */
  showWrapper?: boolean;
  /** Summary text when collapsed */
  collapsedSummary?: string;
  /** Additional class names */
  className?: string;
  /** Compact mode - less padding, smaller text */
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
  const [townSearchQuery, setTownSearchQuery] = useState("");
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

  // Get full state name for display
  const getStateName = (code: string) => {
    return US_STATES.find(s => s.code === code)?.name || code;
  };

  // Normalize state to 2-letter code
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

  // Filter towns based on search query (filter, not gate)
  const getFilteredTowns = () => {
    const query = townSearchQuery.trim().toLowerCase();
    if (!query) return townsList;
    return townsList.filter(town => town.toLowerCase().includes(query));
  };

  const filteredTowns = getFilteredTowns();
  const topLevelTowns = filteredTowns.filter(t => !t.includes('-'));

  // Select all visible towns
  const handleSelectAll = () => {
    const allSelected = topLevelTowns.every(t => selectedTowns.includes(t));
    if (allSelected) {
      updateValue({ towns: [] });
    } else {
      updateValue({ towns: topLevelTowns });
    }
  };

  // Auto-generated summary when collapsed
  const getSummary = () => {
    if (collapsedSummary) return collapsedSummary;
    if (selectedTowns.length === 0) return "All areas";
    if (selectedTowns.length === 1) return selectedTowns[0];
    return `${selectedTowns.length} areas selected`;
  };

  const isBostonSelected = selectedTowns.includes("Boston");

  // Render a single town with optional neighborhoods
  const renderTownItem = (town: string) => {
    const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
    let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
    
    // Fallback: derive from towns list if no neighborhood data
    if ((neighborhoods?.length ?? 0) === 0) {
      neighborhoods = Array.from(new Set(
        townsList
          .filter((t) => t.startsWith(`${town}-`))
          .map((t) => t.split('-').slice(1).join('-'))
      ));
    }

    const showNeighborhoodSection = showAreas && neighborhoods.length > 0;
    const isExpanded = expandedCities.has(town);
    const topCities = new Set(filteredTowns.filter(t => !t.includes('-')));

    return (
      <div key={town} className="space-y-1">
        <div className="flex items-center space-x-2 py-0.5">
          {showNeighborhoodSection && (
            <button
              type="button"
              onClick={() => toggleCityExpansion(town)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          )}
          <Checkbox
            id={`town-${town}`}
            checked={selectedTowns.includes(town)}
            onCheckedChange={() => toggleTown(town)}
          />
          <label htmlFor={`town-${town}`} className="text-sm cursor-pointer flex-1">{town}</label>
        </div>
        
        {town === "Boston" && (
          <div className="ml-6 text-xs text-muted-foreground italic mt-1">
            Selecting Boston alone includes all neighborhoods
          </div>
        )}
        
        {showNeighborhoodSection && isExpanded && (
          <div className="ml-8 border-l-2 border-muted pl-2 space-y-1 rounded-r py-1 bg-muted/30">
            {neighborhoods
              .filter((n) => !topCities.has(n))
              .map((neighborhood) => (
              <div key={`${town}-${neighborhood}`} className="flex items-center space-x-2 py-0.5">
                <Checkbox
                  id={`neighborhood-${town}-${neighborhood}`}
                  checked={selectedTowns.includes(`${town}-${neighborhood}`)}
                  onCheckedChange={() => toggleTown(`${town}-${neighborhood}`)}
                />
                <label 
                  htmlFor={`neighborhood-${town}-${neighborhood}`} 
                  className="text-xs cursor-pointer flex-1 text-muted-foreground"
                >
                  {neighborhood}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {/* State Selection - Full Names Only */}
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

      {/* Town Selection - Native Hierarchical Checkbox List */}
      <div className="space-y-2">
        <Label className={compact ? "text-xs" : undefined}>Towns & Cities</Label>
        
        {/* Search Filter (not a gate) */}
        <Input
          placeholder="Filter towns..."
          value={townSearchQuery}
          onChange={(e) => setTownSearchQuery(e.target.value)}
          className="mb-2"
        />
        
        {/* Towns List - Always visible, search filters */}
        <div className="max-h-64 overflow-y-auto border rounded-lg bg-background p-2">
          {/* Select All */}
          {topLevelTowns.length > 0 && (
            <div className="flex items-center space-x-2 py-0.5 mb-2 pb-2 border-b">
              <Checkbox
                id="select-all-towns"
                checked={topLevelTowns.length > 0 && topLevelTowns.every(t => selectedTowns.includes(t))}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all-towns"
                className="text-sm font-medium cursor-pointer"
              >
                Select All {townSearchQuery.trim() ? `(${topLevelTowns.length} matching)` : `(${topLevelTowns.length})`}
              </label>
            </div>
          )}
          
          {/* Town Items */}
          {topLevelTowns.length > 0 ? (
            <div className="space-y-1">
              {topLevelTowns.map(town => renderTownItem(town))}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {townSearchQuery.trim() 
                ? `No towns matching "${townSearchQuery}"`
                : "No towns available for this selection"}
            </div>
          )}
        </div>
        
        {/* Selected Towns Summary with Chips */}
        {selectedTowns.length > 0 && (
          <div className="mt-3 p-3 bg-card rounded-lg border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Selected</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedTowns.length}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateValue({ towns: [] })}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Clear All
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
            </div>
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
