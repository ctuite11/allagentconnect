import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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

  // Use the proven TownsPicker hook - EXACTLY like Hot Sheets
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: selectedState,
    county: selectedCounty,
    showAreas: true,
  });

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
    // Hook handles expandedCities reset internally via useEffect
  };

  const handleCountyChange = (newCounty: string) => {
    setSelectedCounty(newCounty);
    setSelectedTowns([]);
    setCitySearch("");
    // Hook handles expandedCities reset internally via useEffect
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
      <Card className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-medium text-zinc-900">Geographic Area</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
            </div>
            <CardDescription className="text-left text-sm text-zinc-500 mt-1">
              Select states, counties, and towns for notifications
            </CardDescription>
            {!isOpen && selectedTowns.length > 0 && (
              <div className="mt-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-left">
                <p className="text-sm font-medium text-zinc-900">
                  {selectedTowns.length} area{selectedTowns.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
            {!isOpen && selectedTowns.length === 0 && (
              <p className="text-sm text-zinc-400 mt-1 text-left">
                No geographic areas selected
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-4 px-0 pb-0">
            {/* State & County Selector - Two column layout */}
            <div className="space-y-2">
              {/* Header row with both labels */}
              <div className="grid grid-cols-2 gap-3">
                <Label className="text-sm text-zinc-700">State</Label>
                <Label className="text-sm text-zinc-700">County</Label>
              </div>

              {/* Content row */}
              <div className="grid grid-cols-2 gap-3">
                {/* LEFT: State Selector */}
                <Select value={selectedState} onValueChange={handleStateChange}>
                  <SelectTrigger className="bg-white border-zinc-200 text-zinc-900">
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
                  <SelectTrigger className="bg-white border-zinc-200 text-zinc-900">
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

            {/* Towns Selector - Two column layout */}
            <div className="space-y-2">
              {/* Header row with both labels */}
              <div className="grid grid-cols-2 gap-3">
                <Label className="text-sm text-zinc-700">Towns & Neighborhoods</Label>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-zinc-700">Selected Towns</Label>
                  {selectedTowns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTowns([])}
                      className="text-sm text-zinc-500 hover:text-zinc-900 hover:underline"
                    >
                      Remove all
                    </button>
                  )}
                </div>
              </div>

              {/* Content row */}
              <div className="grid grid-cols-2 gap-3">
                {/* LEFT: Towns Selector */}
                <div className="space-y-2">
                  <Input
                    placeholder="Type Full or Partial Name"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="text-sm bg-white border-zinc-200 text-zinc-900"
                  />
                  <div className="border border-zinc-200 rounded-xl bg-white max-h-80 overflow-y-auto p-2 relative z-10">
                    {/* Add All Towns button */}
                    {townsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="w-full text-left px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded mb-1 border-b border-zinc-200 pb-2"
                      >
                        {selectedCounty === "all" 
                          ? `✓ Add All Towns from All Counties` 
                          : `✓ Add All Towns in County (${townsList.length})`}
                      </button>
                    )}
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
                <div className="border border-zinc-200 rounded-xl p-3 bg-white min-h-[200px] max-h-80 overflow-y-auto">
                  {selectedTowns.length === 0 ? (
                    <p className="text-sm text-zinc-400">No towns selected</p>
                  ) : (
                    selectedTowns.map((town) => (
                      <button
                        key={town}
                        type="button"
                        onClick={() => handleToggleTown(town)}
                        className="w-full text-left py-1 px-2 text-sm text-zinc-900 font-medium border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 rounded cursor-pointer"
                      >
                        {town}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {selectedTowns.length > 100 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-900 font-medium">
                      You have selected {selectedTowns.length} areas
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Consider narrowing your coverage for more focused alerts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedTowns.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
                <p className="text-sm">
                  <span className="font-medium text-zinc-700">You will receive notifications for:</span>
                  <br />
                  <span className="text-zinc-900 font-medium">
                    {selectedTowns.join(", ")}
                  </span>
                </p>
              </div>
            )}

            {selectedTowns.length === 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">No geographic areas selected</span>
                  <br />
                  <span className="text-zinc-500">
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
