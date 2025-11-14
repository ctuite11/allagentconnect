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
import { X, ArrowUp, Loader2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";

interface GeographicPreferencesManagerProps {
  agentId: string;
}

const GeographicPreferencesManager = ({ agentId }: GeographicPreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Town filters
  const [state, setState] = useState("MA");
  const [county, setCounty] = useState("all");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState("yes");
  const [townSearch, setTownSearch] = useState("");
  const [manualTowns, setManualTowns] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { townsList, expandedCities, toggleCityExpansion, hasCountyData } = useTownsPicker({
    state,
    county,
    showAreas: showAreas === "yes",
  });

  const currentStateCounties = hasCountyData ? getCountiesForState(state) : [];

  useEffect(() => {
    loadPreferences();
  }, [agentId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);

      // Load agent's current preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*")
        .eq("agent_id", agentId);

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
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing preferences for this agent
      const { error: deleteError } = await supabase
        .from("agent_buyer_coverage_areas")
        .delete()
        .eq("agent_id", agentId);

      if (deleteError) throw deleteError;

      // Insert new preferences (remove duplicates before saving)
      const uniqueTowns = [...new Set(selectedTowns)];
      if (uniqueTowns.length > 0) {
        const preferencesToInsert = uniqueTowns.map(town => {
          // Check if it's a neighborhood (contains hyphen)
          if (town.includes('-')) {
            const [city, neighborhood] = town.split('-');
            return {
              agent_id: agentId,
              state,
              county: county === "all" ? null : county,
              city,
              neighborhood,
              zip_code: "", // We'll populate this later if needed
            };
          }
          return {
            agent_id: agentId,
            state,
            county: county === "all" ? null : county,
            city: town,
            neighborhood: null,
            zip_code: "", // We'll populate this later if needed
          };
        });

        const { error: insertError } = await supabase
          .from("agent_buyer_coverage_areas")
          .insert(preferencesToInsert);

        if (insertError) throw insertError;
      }

      toast.success("Geographic preferences saved successfully!");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const toggleTown = (town: string) => {
    setSelectedTowns(prev =>
      prev.includes(town)
        ? prev.filter(t => t !== town)
        : [...prev, town]
    );
  };

  const addAllTowns = () => {
    setSelectedTowns(townsList);
  };

  const removeAllTowns = () => {
    setSelectedTowns([]);
  };

  const addManualTowns = () => {
    if (!manualTowns.trim()) return;
    const newTowns = manualTowns
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    setSelectedTowns(prev => [...new Set([...prev, ...newTowns])]);
    setManualTowns("");
  };

  const removeTown = (town: string) => {
    setSelectedTowns(prev => prev.filter(t => t !== town));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                <CardTitle>Geographic Area Preferences</CardTitle>
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
              <Button 
                variant="link"
                className="text-xs gap-1 h-auto p-0"
                onClick={scrollToTop}
              >
                BACK TO TOP <ArrowUp className="h-3 w-3" />
              </Button>
            </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <Label className="text-xs">State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-50 max-h-[300px]">
                {US_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Coverage Areas</Label>
            <Select value={county} onValueChange={setCounty} disabled={!hasCountyData}>
              <SelectTrigger className={!hasCountyData ? "opacity-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
              <SelectContent className="z-50 max-h-[300px]">
                <SelectItem value="all">All Counties</SelectItem>
                {hasCountyData && currentStateCounties.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
          <Input value={townSearch} onChange={(e) => setTownSearch(e.target.value)} placeholder="Type Full or Partial Name" className="pr-8" />
          {townSearch && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setTownSearch("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="max-h-60 overflow-y-auto border rounded bg-background z-10 relative">
              <div className="p-2 hover:bg-muted cursor-pointer border-b font-semibold text-sm bg-background" onClick={addAllTowns}>
                ✓ Add All Towns from All Counties
              </div>
              <div className="p-2">
                <TownsPicker
                  towns={townsList}
                  selectedTowns={selectedTowns}
                  onToggleTown={toggleTown}
                  expandedCities={expandedCities}
                  onToggleCityExpansion={toggleCityExpansion}
                  state={state}
                  searchQuery={townSearch}
                  variant="checkbox"
                  showAreas={showAreas === "yes"}
                />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs mb-1 block">Type Multiple Towns/Areas</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Separate multiple towns with commas</p>
              <div className="flex gap-2">
                <Textarea 
                  value={manualTowns} 
                  onChange={(e) => setManualTowns(e.target.value)} 
                  rows={2} 
                  className="flex-1"
                  placeholder="e.g. Northborough, Worcester, Boston" 
                />
                <Button onClick={addManualTowns} size="sm">Add</Button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Selected Towns</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={removeAllTowns}>Remove All</Button>
            </div>
            <div className="border rounded bg-background p-2 max-h-[17.5rem] overflow-y-auto">
              {selectedTowns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No towns selected</p>
              ) : (
                <div className="space-y-1">
                  {selectedTowns.map((town) => (
                    <div key={town} className="flex items-center justify-between text-xs py-1 px-2 hover:bg-muted rounded group">
                      <span>{town}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeTown(town)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTowns.length} {selectedTowns.length === 1 ? 'town' : 'towns'} selected
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Geographic Preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};

export default GeographicPreferencesManager;
