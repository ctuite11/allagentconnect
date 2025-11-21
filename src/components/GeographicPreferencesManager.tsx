import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { X, ArrowUp, Loader2, MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
interface GeographicPreferencesManagerProps {
  agentId: string;
  onFiltersUpdated?: (hasFilters: boolean) => void;
}
const GeographicPreferencesManager = ({
  agentId,
  onFiltersUpdated
}: GeographicPreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Town filters
  const [state, setState] = useState("MA");
  const [county, setCounty] = useState("all");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState("yes");
  const [townSearch, setTownSearch] = useState("");
  const [manualTowns, setManualTowns] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [confirmSelectAllOpen, setConfirmSelectAllOpen] = useState(false);
  const {
    townsList,
    expandedCities,
    toggleCityExpansion,
    hasCountyData
  } = useTownsPicker({
    state,
    county,
    showAreas: showAreas === "yes"
  });
  const currentStateCounties = hasCountyData ? getCountiesForState(state) : [];
  useEffect(() => {
    loadPreferences();
  }, [agentId]);

  // Auto-save whenever selectedTowns changes (debounced)
  useEffect(() => {
    // Only auto-save if we're not in the initial loading state
    if (!loading && agentId) {
      const handle = setTimeout(() => {
        autoSave(selectedTowns);
      }, 400);

      return () => clearTimeout(handle);
    }
  }, [selectedTowns, agentId, loading]);
  const loadPreferences = async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);

      // Load agent's current preferences (notifications only)
      const {
        data: prefsData,
        error: prefsError
      } = await supabase.from("agent_buyer_coverage_areas").select("*").eq("agent_id", agentId).eq("source", "notifications");
      if (prefsError) throw prefsError;
      if (prefsData && prefsData.length > 0) {
        // Extract state from first preference
        const firstState = prefsData[0].state;
        if (firstState) setState(firstState);

        // Build selected towns list and remove duplicates
        const towns = prefsData.map(p => {
          if (p.neighborhood) {
            return `${p.city}-${p.neighborhood}`;
          }
          return p.city;
        });
        // Remove duplicate cities
        setSelectedTowns([...new Set(towns)]);
      }
    } catch (error: any) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };
  const autoSave = async (towns: string[]) => {
    // Early guard - don't save without agent ID
    if (!agentId || agentId === "") return;
    
    // Prevent overlapping saves
    if (saving) return;
    
    setSaving(true);
    try {
      // Delete all existing notification preferences for this agent
      const { error: deleteError } = await supabase
        .from("agent_buyer_coverage_areas")
        .delete()
        .eq("agent_id", agentId)
        .eq("source", "notifications");
      if (deleteError) throw deleteError;

      // Only insert if there are towns to save
      if (towns.length > 0) {
        // Insert new preferences (remove duplicates before saving)
        const uniqueTowns = [...new Set(towns)];
        const preferencesToInsert = uniqueTowns.map((town, index) => {
          // Generate unique synthetic zip code for each town
          const syntheticZip = String(index).padStart(5, "0");
          
          // Check if it's a neighborhood (contains hyphen)
          if (town.includes('-')) {
            const [city, neighborhood] = town.split('-');
            return {
              agent_id: agentId,
              state,
              county: county === "all" ? null : county,
              city,
              neighborhood,
              zip_code: syntheticZip,
              source: "notifications",
            };
          } else {
            return {
              agent_id: agentId,
              state,
              county: county === "all" ? null : county,
              city: town,
              neighborhood: null,
              zip_code: syntheticZip,
              source: "notifications",
            };
          }
        });
        const { error: insertError } = await supabase
          .from("agent_buyer_coverage_areas")
          .insert(preferencesToInsert);
        if (insertError) throw insertError;
        
        // Notify parent that filters have been updated
        onFiltersUpdated?.(true);
      } else {
        // Empty selection means no filters
        onFiltersUpdated?.(false);
      }
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error(
        `There was a problem saving your coverage areas: ${
          error?.message || error?.code || "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  };
  const selectAllCountiesAndTowns = () => {
    // Ensure we have county-city mapping for this state
    const counties = hasCountyData ? getCountiesForState(state) : [];
    const allCities: string[] = [];

    if (counties.length > 0) {
      counties.forEach(c => {
        const cities = getCitiesForCounty(state, c) || [];
        allCities.push(...cities);
      });
    }

    // Fallback: if no county mapping, use current townsList
    const baseCities = allCities.length > 0 ? Array.from(new Set(allCities)) : townsList;

    if (showAreas === "yes") {
      const withNeighborhoods: string[] = [];
      baseCities.forEach(city => {
        withNeighborhoods.push(city);
        const neighborhoods = getAreasForCity(city, state);
        neighborhoods.forEach(n => withNeighborhoods.push(`${city}-${n}`));
      });
      const newTowns = Array.from(new Set(withNeighborhoods));
      setSelectedTowns(newTowns);
    } else {
      const newTowns = Array.from(new Set(baseCities));
      setSelectedTowns(newTowns);
    }

    // Reflect UI that we're on "All Counties"
    setCounty("all");
  };

  const toggleTown = (town: string) => {
    setSelectedTowns(prev => prev.includes(town) ? prev.filter(t => t !== town) : [...prev, town]);
  };
  const addAllTowns = () => {
    const selection = new Set<string>(townsList);

    if (showAreas === "yes") {
      // Include both cities and their neighborhoods
      townsList.forEach((city) => {
        if (city.includes('-')) return;
        let neighborhoods = getAreasForCity(city, state) || [];
        if ((neighborhoods?.length ?? 0) === 0) {
          neighborhoods = Array.from(new Set(
            townsList
              .filter((t) => t.startsWith(`${city}-`))
              .map((t) => t.split('-').slice(1).join('-'))
          ));
        }
        neighborhoods.forEach((n) => selection.add(`${city}-${n}`));
      });
    }

    setSelectedTowns(Array.from(selection));
  };
  const removeAllTowns = () => {
    setSelectedTowns([]);
  };
  const addManualTowns = () => {
    if (!manualTowns.trim()) return;
    const newTowns = manualTowns.split(',').map(t => t.trim()).filter(t => t.length > 0);
    setSelectedTowns(prev => [...new Set([...prev, ...newTowns])]);
    setManualTowns("");
  };
  const removeTown = (town: string) => {
    setSelectedTowns(prev => prev.filter(t => t !== town));
  };
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  if (loading) {
    return <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>;
  }
  return <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-end">
              <Button variant="link" className="text-xs gap-1 h-auto p-0" onClick={scrollToTop}>
                BACK TO TOP <ArrowUp className="h-3 w-3" />
              </Button>
            </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <Label className="text-xs">State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-50 max-h-[300px]">
                {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Coverage Areas</Label>
            <Select value={county} onValueChange={setCounty} disabled={!hasCountyData}>
              <SelectTrigger className={!hasCountyData ? "opacity-50 cursor-not-allowed" : ""}><SelectValue placeholder="All Counties" /></SelectTrigger>
              <SelectContent className="z-50 max-h-[300px]">
                <SelectItem value="all">All Counties</SelectItem>
                {hasCountyData && currentStateCounties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Show Areas</Label>
            <RadioGroup value={showAreas} onValueChange={setShowAreas} className="flex gap-3">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="yes" id="show-yes" />
                <Label htmlFor="show-yes" className="text-sm cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="no" id="show-no" />
                <Label htmlFor="show-no" className="text-sm cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="relative">
          <Input value={townSearch} onChange={e => setTownSearch(e.target.value)} placeholder="Type Full or Partial Name" className="pr-8" />
          {townSearch && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setTownSearch("")}>
              <X className="h-4 w-4" />
            </Button>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">
            {/* IMPORTANT: Confirmation required to prevent accidental mass-selection of 300+ towns
                This is tightly coupled to agent_buyer_coverage_areas and should not be removed */}
            <Button 
              onClick={() => setConfirmSelectAllOpen(true)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Select All Towns & Neighborhoods
            </Button>
            
            <AlertDialog open={confirmSelectAllOpen} onOpenChange={setConfirmSelectAllOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Select all towns & neighborhoods?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will add every town (and available neighborhoods) in {state} as coverage areas. 
                    This can be 300+ locations and will replace your current selection.
                    <br /><br />
                    Consider selecting specific counties or towns instead for more focused buyer alerts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      addAllTowns();
                      setConfirmSelectAllOpen(false);
                    }}
                  >
                    Yes, select all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <div className="max-h-96 overflow-y-auto border rounded bg-background relative z-10">
              <div className="p-2">
                <TownsPicker towns={townsList} selectedTowns={selectedTowns} onToggleTown={toggleTown} expandedCities={expandedCities} onToggleCityExpansion={toggleCityExpansion} state={state} searchQuery={townSearch} variant="checkbox" showAreas={showAreas === "yes"} />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs mb-1 block">Type Multiple Towns/Areas</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Separate multiple towns with commas</p>
              <div className="flex gap-2">
                <Textarea value={manualTowns} onChange={e => setManualTowns(e.target.value)} rows={2} className="flex-1" placeholder="e.g. Northborough, Worcester, Boston" />
                <Button onClick={addManualTowns} size="sm">Add</Button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Selected Towns ({selectedTowns.length})</Label>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={removeAllTowns}>Clear All</Button>
            </div>
            <div className="border rounded bg-background p-2 max-h-96 overflow-y-auto">
              {selectedTowns.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No towns selected</p> : <div className="space-y-1">
                  {selectedTowns.map(town => <div key={town} className="flex items-center justify-between text-xs py-1 px-2 hover:bg-muted rounded cursor-pointer" onClick={() => removeTown(town)} role="button" aria-label={`Remove ${town}`} title="Click to remove">
                      <span>{town}</span>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={e => {
                      e.stopPropagation();
                      removeTown(town);
                    }} title="Click to remove">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>)}
                </div>}
            </div>
          </div>
        </div>

        {selectedTowns.length > 100 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                  You have selected {selectedTowns.length} areas
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Consider narrowing your coverage for more focused alerts and a cleaner profile display. 
                  You can use the "Clear All" button to start over.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedTowns.length === 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-medium">No geographic areas selected.</span>
              <br />
              <span className="text-blue-700 dark:text-blue-300">
                You will receive notifications for client needs in all areas.
              </span>
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTowns.length} {selectedTowns.length === 1 ? 'town' : 'towns'} selected
          </p>
        </div>
      </CardContent>
    </CollapsibleContent>
    </Card>
    </Collapsible>;
};
export default GeographicPreferencesManager;