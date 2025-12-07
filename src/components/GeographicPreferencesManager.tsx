import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, MapPin, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

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

const GeographicPreferencesManager = ({
  agentId,
  onFiltersUpdated,
  onDataChange
}: GeographicPreferencesManagerProps) => {
  const [loading, setLoading] = useState(true);
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

  // Notify parent of data changes (no autosave)
  const notifyChange = useCallback(() => {
    const hasFilter = geoSelection.towns.length > 0;
    onFiltersUpdated?.(hasFilter);
    
    onDataChange?.({
      state: geoSelection.state,
      county: geoSelection.county,
      towns: geoSelection.towns,
    });
  }, [geoSelection, onFiltersUpdated, onDataChange]);

  useEffect(() => {
    if (!loading) {
      notifyChange();
    }
  }, [geoSelection, loading, notifyChange]);

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
          <CardContent className="space-y-3 pt-0">
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
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default GeographicPreferencesManager;
