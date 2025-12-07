import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
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

  const topLevelTowns = townsList.filter(t => !t.includes('-'));

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

      {/* Town Selection - Multi-Select Dropdown (Same Style as State/County) */}
      <div className="space-y-2">
        <Label className={compact ? "text-xs" : undefined}>Towns & Cities</Label>
        <Select
          value=""
          onValueChange={(town) => {
            if (town === "__select_all__") {
              handleSelectAll();
            } else if (town) {
              toggleTown(town);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={selectedTowns.length > 0 ? `${selectedTowns.length} selected` : "Select towns..."} />
          </SelectTrigger>
          <SelectContent className="z-50 max-h-[300px]">
            {topLevelTowns.length > 0 ? (
              <>
                <SelectItem value="__select_all__">
                  <span className="font-medium">
                    {topLevelTowns.every(t => selectedTowns.includes(t)) ? "Deselect All" : "Select All"} ({topLevelTowns.length})
                  </span>
                </SelectItem>
                {topLevelTowns.map((town) => {
                  const isSelected = selectedTowns.includes(town);
                  return (
                    <SelectItem key={town} value={town}>
                      <span className={isSelected ? "font-medium text-primary" : ""}>
                        {isSelected ? "✓ " : ""}{town}
                      </span>
                    </SelectItem>
                  );
                })}
              </>
            ) : (
              <SelectItem value="__none__" disabled>
                No towns available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        
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
