import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { US_STATES } from "@/data/usStatesCountiesData";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";
import { CT_COUNTY_TOWNS } from "@/data/ctCountyTowns";
import { RI_COUNTY_TOWNS } from "@/data/riCountyTowns";
import { NH_COUNTY_TOWNS } from "@/data/nhCountyTowns";
import { VT_COUNTY_TOWNS } from "@/data/vtCountyTowns";
import { ME_COUNTY_TOWNS } from "@/data/meCountyTowns";

export interface GeographicData {
  state: string;
  county: string;
  towns: string[];
}

interface GeographicPreferencesManagerProps {
  agentId: string;
  onFiltersUpdated?: (hasFilters: boolean) => void;
  onDataChange?: (data: GeographicData) => void;
}

// Get counties for a state
const getCountiesForState = (stateCode: string): string[] => {
  const countyMaps: Record<string, Record<string, string[]>> = {
    MA: MA_COUNTY_TOWNS,
    CT: CT_COUNTY_TOWNS,
    RI: RI_COUNTY_TOWNS,
    NH: NH_COUNTY_TOWNS,
    VT: VT_COUNTY_TOWNS,
    ME: ME_COUNTY_TOWNS,
  };
  const map = countyMaps[stateCode];
  if (map) {
    return Object.keys(map).sort();
  }
  return [];
};

const GeographicPreferencesManager = ({
  agentId,
  onFiltersUpdated,
  onDataChange
}: GeographicPreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  const [selectedState, setSelectedState] = useState("MA");
  const [selectedCounty, setSelectedCounty] = useState("all");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  
  // LIFTED STATE: expandedCities lives in parent to prevent reset on TownsPicker remount
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Use the proven TownsPicker hook - only for townsList
  const { townsList } = useTownsPicker({
    state: selectedState,
    county: selectedCounty,
    showAreas: true,
  });
  
  // Toggle city expansion - managed in parent
  const toggleCityExpansion = (city: string) => {
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

  // Get available counties for selected state
  const availableCounties = getCountiesForState(selectedState);

  useEffect(() => {
    loadPreferences();
  }, [agentId]);

  // Notify parent of data changes (no autosave)
  const notifyChange = useCallback(() => {
    const hasFilter = selectedTowns.length > 0;
    onFiltersUpdated?.(hasFilter);
    
    onDataChange?.({
      state: selectedState,
      county: selectedCounty,
      towns: selectedTowns,
    });
  }, [selectedState, selectedCounty, selectedTowns, onFiltersUpdated, onDataChange]);

  useEffect(() => {
    if (!loading) {
      notifyChange();
    }
  }, [selectedState, selectedCounty, selectedTowns, loading, notifyChange]);

  const loadPreferences = async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);

      const { data: prefsData, error: prefsError } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*")
        .eq("agent_id", agentId)
        .eq("source", "notifications");

      if (prefsError) throw prefsError;

      if (prefsData && prefsData.length > 0) {
        // SAFETY GUARD: Filter out any legacy records with neighborhood data
        // These are artifacts from the old broken selector logic and must never rehydrate
        const cleanRecords = prefsData.filter(p => !p.neighborhood);

        if (cleanRecords.length > 0) {
          const firstState = cleanRecords[0].state;
          const towns = cleanRecords.map(p => p.city);

          setSelectedState(firstState || "MA");
          setSelectedCounty(cleanRecords[0].county || "all");
          setSelectedTowns([...new Set(towns)] as string[]);
        }
      }
    } catch (error: any) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedCounty("all");
    setSelectedTowns([]);
    setCitySearch("");
    setExpandedCities(new Set()); // Reset expansions on state change
  };

  const handleCountyChange = (newCounty: string) => {
    setSelectedCounty(newCounty);
    setSelectedTowns([]);
    setCitySearch("");
    setExpandedCities(new Set()); // Reset expansions on county change
  };

  const handleToggleTown = (town: string) => {
    setSelectedTowns(prev => {
      if (prev.includes(town)) {
        return prev.filter(t => t !== town);
      } else {
        return [...prev, town];
      }
    });
  };

  const handleSelectAll = () => {
    const topLevelTowns = townsList.filter(t => !t.includes('-'));
    const allSelected = topLevelTowns.every(t => selectedTowns.includes(t));
    
    if (allSelected) {
      // Deselect all
      setSelectedTowns([]);
    } else {
      // Select all top-level towns
      setSelectedTowns(topLevelTowns);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <CardTitle>Geographic Area</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
            </div>
            <CardDescription className="text-left">
              Select states, counties, and towns for notifications
            </CardDescription>
            {!isOpen && (
              <p className="text-sm text-muted-foreground mt-1 text-left">
                {selectedTowns.length > 0 
                  ? `${selectedTowns.length} area${selectedTowns.length !== 1 ? 's' : ''} selected`
                  : "All areas"}
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* State & County Selector - Two column layout */}
            <div className="space-y-2">
              {/* Header row with both labels */}
              <div className="grid grid-cols-2 gap-4">
                <Label>State</Label>
                <Label>County</Label>
              </div>

              {/* Content row */}
              <div className="grid grid-cols-2 gap-4">
                {/* LEFT: State Selector */}
                <Select value={selectedState} onValueChange={handleStateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* RIGHT: County Selector */}
                <Select 
                  value={selectedCounty} 
                  onValueChange={handleCountyChange}
                  disabled={availableCounties.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={availableCounties.length === 0 ? "Select state first" : "All counties"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Counties</SelectItem>
                    {availableCounties.map((county) => (
                      <SelectItem key={county} value={county}>
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Towns Selector - Two column layout matching Hot Sheets */}
            <div className="space-y-2">
              {/* Header row with both labels */}
              <div className="grid grid-cols-2 gap-4">
                <Label>Towns & Neighborhoods</Label>
                <div className="flex items-center justify-between">
                  <Label>Selected Towns</Label>
                  {selectedTowns.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTowns([])}
                      className="h-6 px-2 text-xs"
                    >
                      Remove All
                    </Button>
                  )}
                </div>
              </div>

              {/* Content row */}
              <div className="grid grid-cols-2 gap-4">
                {/* LEFT: Towns Selector - CLONED FROM HOT SHEETS EXACTLY */}
                <div className="space-y-2">
                  <Input
                    placeholder="Type Full or Partial Name"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="text-sm"
                  />
                  <div className="border rounded-md bg-background max-h-60 overflow-y-auto p-2 relative z-10">
                    <TownsPicker
                      towns={townsList}
                      selectedTowns={selectedTowns}
                      onToggleTown={handleToggleTown}
                      expandedCities={expandedCities}
                      onToggleCityExpansion={toggleCityExpansion}
                      state={selectedState}
                      searchQuery={citySearch}
                      variant="button"
                      showAreas={true}
                    />
                  </div>
                </div>

                {/* RIGHT: Selected Towns Panel */}
                <div className="border rounded-md bg-background max-h-60 overflow-y-auto p-2 relative z-10">
                  {selectedTowns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No towns selected</p>
                  ) : (
                    selectedTowns.map((town) => (
                      <button
                        key={town}
                        type="button"
                        onClick={() => handleToggleTown(town)}
                        className="w-full text-left py-1 px-2 text-sm border-b last:border-b-0 hover:bg-muted rounded cursor-pointer"
                      >
                        {town}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {selectedTowns.length > 100 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                      You have selected {selectedTowns.length} areas
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Consider narrowing your coverage for more focused alerts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedTowns.length === 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <span className="font-medium">No geographic areas selected.</span>
                  <br />
                  <span className="text-blue-700 dark:text-blue-300">
                    You will receive notifications for client needs in all areas.
                  </span>
                </p>
              </div>
            )}

          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default GeographicPreferencesManager;
