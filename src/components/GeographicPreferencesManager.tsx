import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

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
  const [isOpen, setIsOpen] = useState(false);
  
  const [geoSelection, setGeoSelection] = useState<GeographicSelection>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
  });

  useEffect(() => {
    loadPreferences();
  }, [agentId]);

  // Auto-save whenever selection changes (debounced)
  useEffect(() => {
    if (!loading && agentId) {
      const handle = setTimeout(() => {
        autoSave(geoSelection);
      }, 400);
      return () => clearTimeout(handle);
    }
  }, [geoSelection, agentId, loading]);

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
        const firstState = prefsData[0].state;
        const towns = prefsData.map(p => {
          if (p.neighborhood) {
            return `${p.city}-${p.neighborhood}`;
          }
          return p.city;
        });

        setGeoSelection({
          state: firstState || "MA",
          county: prefsData[0].county || "all",
          towns: [...new Set(towns)],
          showAreas: true,
        });
      }
    } catch (error: any) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const autoSave = async (selection: GeographicSelection) => {
    if (!agentId || agentId === "") return;
    if (saving) return;
    
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from("agent_buyer_coverage_areas")
        .delete()
        .eq("agent_id", agentId)
        .eq("source", "notifications");

      if (deleteError) throw deleteError;

      if (selection.towns.length > 0) {
        const uniqueTowns = [...new Set(selection.towns)];
        const preferencesToInsert = uniqueTowns.map((town, index) => {
          const syntheticZip = String(index).padStart(5, "0");
          
          if (town.includes('-')) {
            const [city, neighborhood] = town.split('-');
            return {
              agent_id: agentId,
              state: selection.state,
              county: selection.county === "all" ? null : selection.county,
              city,
              neighborhood,
              zip_code: syntheticZip,
              source: "notifications",
            };
          } else {
            return {
              agent_id: agentId,
              state: selection.state,
              county: selection.county === "all" ? null : selection.county,
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
        onFiltersUpdated?.(true);
      } else {
        onFiltersUpdated?.(false);
      }
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error(`There was a problem saving your coverage areas: ${error?.message || error?.code || "Unknown error"}`);
    } finally {
      setSaving(false);
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

  const selectedTowns = geoSelection.towns;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <CardTitle>Geographic Area</CardTitle>
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                  : "No geographic areas selected — receiving all"}
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Unified Geographic Selector */}
            <GeographicSelector
              value={geoSelection}
              onChange={setGeoSelection}
              showWrapper={false}
              defaultCollapsed={false}
            />

            {selectedTowns.length > 100 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-4">
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
                {saving && " • Saving..."}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default GeographicPreferencesManager;
