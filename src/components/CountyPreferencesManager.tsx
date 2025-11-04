import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface County {
  id: string;
  name: string;
  state: string;
}

interface CountyPreferencesManagerProps {
  agentId: string;
}

const CountyPreferencesManager = ({ agentId }: CountyPreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [agentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all counties
      const { data: countiesData, error: countiesError } = await supabase
        .from("counties")
        .select("*")
        .order("state", { ascending: true })
        .order("name", { ascending: true });

      if (countiesError) throw countiesError;
      setCounties(countiesData || []);

      // Load agent's current preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from("agent_county_preferences")
        .select("county_id")
        .eq("agent_id", agentId);

      if (prefsError) throw prefsError;
      setSelectedCounties(prefsData?.map(p => p.county_id) || []);

      // Set default state if agent has preferences
      if (prefsData && prefsData.length > 0 && countiesData) {
        const firstCounty = countiesData.find(c => c.id === prefsData[0].county_id);
        if (firstCounty) {
          setSelectedState(firstCounty.state);
        }
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load coverage areas");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing preferences for this agent
      const { error: deleteError } = await supabase
        .from("agent_county_preferences")
        .delete()
        .eq("agent_id", agentId);

      if (deleteError) throw deleteError;

      // Insert new preferences
      if (selectedCounties.length > 0) {
        const { error: insertError } = await supabase
          .from("agent_county_preferences")
          .insert(
            selectedCounties.map(countyId => ({
              agent_id: agentId,
              county_id: countyId,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success("Coverage areas updated successfully!");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save coverage areas");
    } finally {
      setSaving(false);
    }
  };

  const toggleCounty = (countyId: string) => {
    setSelectedCounties(prev =>
      prev.includes(countyId)
        ? prev.filter(id => id !== countyId)
        : [...prev, countyId]
    );
  };

  const selectAllInState = (state: string) => {
    const stateCounties = counties.filter(c => c.state === state);
    const stateCountyIds = stateCounties.map(c => c.id);
    const allSelected = stateCountyIds.every(id => selectedCounties.includes(id));

    if (allSelected) {
      // Deselect all in state
      setSelectedCounties(prev => prev.filter(id => !stateCountyIds.includes(id)));
    } else {
      // Select all in state
      const newSelected = [...new Set([...selectedCounties, ...stateCountyIds])];
      setSelectedCounties(newSelected);
    }
  };

  const uniqueStates = [...new Set(counties.map(c => c.state))].sort();
  const filteredCounties = selectedState
    ? counties.filter(c => c.state === selectedState)
    : counties;

  const countiesInSelectedState = counties.filter(c => c.state === selectedState);
  const allStateCountiesSelected = selectedState && countiesInSelectedState.length > 0 &&
    countiesInSelectedState.every(c => selectedCounties.includes(c.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage Areas</CardTitle>
        <CardDescription>
          Select the counties where you provide real estate services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Filter by State</Label>
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger>
              <SelectValue placeholder="Select a state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All States</SelectItem>
              {uniqueStates.map(state => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedState && (
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="select-all-state"
              checked={allStateCountiesSelected}
              onCheckedChange={() => selectAllInState(selectedState)}
            />
            <Label
              htmlFor="select-all-state"
              className="font-semibold cursor-pointer"
            >
              All towns in {selectedState}
            </Label>
          </div>
        )}

        <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
          <div className="grid gap-3">
            {filteredCounties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {selectedState ? "No counties found for this state" : "Select a state to view counties"}
              </p>
            ) : (
              filteredCounties.map((county) => (
                <div key={county.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`county-${county.id}`}
                    checked={selectedCounties.includes(county.id)}
                    onCheckedChange={() => toggleCounty(county.id)}
                  />
                  <Label
                    htmlFor={`county-${county.id}`}
                    className="cursor-pointer flex-1"
                  >
                    {county.name}, {county.state}
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedCounties.length} {selectedCounties.length === 1 ? 'county' : 'counties'} selected
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Coverage Areas"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountyPreferencesManager;
