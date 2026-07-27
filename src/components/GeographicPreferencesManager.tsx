import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
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
      <Card className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-0" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-5 w-5 !text-[#16A34A]" strokeWidth={2} aria-hidden />
                <CardTitle className="text-base font-semibold text-neutral-900">Coverage Area</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-neutral-400" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-5 w-5 text-neutral-400" strokeWidth={2} />
              )}
            </div>
            <CardDescription className="mt-1 text-left text-sm text-neutral-500">
              Choose the areas where you want to receive relevant alerts.
            </CardDescription>
            {!isOpen && selectedTowns.length > 0 && (
              <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left">
                <p className="text-sm font-medium text-neutral-900">
                  {selectedTowns.length} area{selectedTowns.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
            {!isOpen && selectedTowns.length === 0 && (
              <p className="mt-1 text-left text-sm text-neutral-500">No geographic areas selected</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 px-0 pb-0 pt-4">
            {/* State & County Selector - Two column layout */}
            <div className="space-y-2">
              {/* Header row with both labels */}
              <div className="grid grid-cols-2 gap-3">
                <Label className="text-sm text-neutral-700">State</Label>
                <Label className="text-sm text-neutral-700">County</Label>
              </div>

              {/* Content row */}
              <div className="grid grid-cols-2 gap-3">
                {/* LEFT: State Selector */}
                <Select value={selectedState} onValueChange={handleStateChange}>
                  <SelectTrigger className="border-neutral-200 bg-white text-neutral-900">
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
                  <SelectTrigger className="border-neutral-200 bg-white text-neutral-900">
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
                <Label className="text-sm text-neutral-700">Towns & Neighborhoods</Label>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-neutral-700">Selected Towns</Label>
                  {selectedTowns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTowns([])}
                      className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline"
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
                    className="border-neutral-200 bg-white text-sm text-neutral-900"
                  />
                  <div className="relative z-10 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
                    {/* Add All Towns button */}
                    {townsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="mb-1 w-full rounded px-2 py-1.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                      >
{`- Add All Towns (${townsList.length}) -`}
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
                <div className="min-h-[200px] max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3">
                  {selectedTowns.length === 0 ? (
                    <p className="text-sm text-neutral-500">No towns selected</p>
                  ) : (
                    selectedTowns.map((town) => (
                      <button
                        key={town}
                        type="button"
                        onClick={() => handleToggleTown(town)}
                        className="w-full cursor-pointer rounded border-b border-neutral-100 px-2 py-1 text-left text-sm font-medium text-neutral-900 last:border-b-0 hover:bg-neutral-50/80"
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
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" strokeWidth={2} />
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
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm">
                  <span className="font-medium text-neutral-600">You will receive notifications for:</span>
                  <br />
                  <span className="font-medium text-neutral-900">{selectedTowns.join(", ")}</span>
                </p>
              </div>
            )}

            {selectedTowns.length === 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm text-neutral-600">
                  <span className="font-medium text-neutral-900">No geographic areas selected</span>
                  <br />
                  <span className="text-neutral-500">
                    You will receive notifications in all areas.
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
