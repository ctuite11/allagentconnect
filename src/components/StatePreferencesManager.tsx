import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { US_STATES } from "@/data/usStatesCountiesData";

interface StatePreferencesManagerProps {
  agentId: string;
}

const StatePreferencesManager = ({ agentId }: StatePreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  useEffect(() => {
    loadPreferences();
  }, [agentId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);

      // Load agent's current state preferences
      const { data, error } = await supabase
        .from("agent_state_preferences")
        .select("state")
        .eq("agent_id", agentId);

      if (error) throw error;
      setSelectedStates(data?.map(p => p.state) || []);
    } catch (error: any) {
      console.error("Error loading state preferences:", error);
      toast.error("Failed to load state preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing preferences for this agent
      const { error: deleteError } = await supabase
        .from("agent_state_preferences")
        .delete()
        .eq("agent_id", agentId);

      if (deleteError) throw deleteError;

      // Insert new preferences
      if (selectedStates.length > 0) {
        const { error: insertError } = await supabase
          .from("agent_state_preferences")
          .insert(
            selectedStates.map(state => ({
              agent_id: agentId,
              state: state,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success("State preferences updated successfully!");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save state preferences");
    } finally {
      setSaving(false);
    }
  };

  const toggleState = (stateCode: string) => {
    setSelectedStates(prev =>
      prev.includes(stateCode)
        ? prev.filter(s => s !== stateCode)
        : [...prev, stateCode]
    );
  };

  const selectAll = () => {
    if (selectedStates.length === US_STATES.length) {
      setSelectedStates([]);
    } else {
      setSelectedStates(US_STATES.map(s => s.code));
    }
  };

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
        <CardTitle>State Coverage Preferences</CardTitle>
        <CardDescription>
          Select the states where you provide real estate services. You'll receive notifications when new client needs are submitted in these states.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
          <Checkbox
            id="select-all-states"
            checked={selectedStates.length === US_STATES.length}
            onCheckedChange={selectAll}
          />
          <Label
            htmlFor="select-all-states"
            className="font-semibold cursor-pointer"
          >
            Select All States
          </Label>
        </div>

        <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {US_STATES.map((state) => (
              <div key={state.code} className="flex items-center space-x-2">
                <Checkbox
                  id={`state-${state.code}`}
                  checked={selectedStates.includes(state.code)}
                  onCheckedChange={() => toggleState(state.code)}
                />
                <Label
                  htmlFor={`state-${state.code}`}
                  className="cursor-pointer flex-1"
                >
                  {state.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedStates.length} {selectedStates.length === 1 ? 'state' : 'states'} selected
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatePreferencesManager;
